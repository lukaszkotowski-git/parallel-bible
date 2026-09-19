/**
 * Gamifikacja po stronie serwera. Zasada: nic tu nie jest licznikiem „na sztywno" —
 * XP, poziom i postęp każdej odznaki liczymy z danych (`loadFacts`). W bazie zostaje tylko
 * to, czego nie da się odtworzyć: cel dzienny, przyznane odznaki i przywrócenia serii.
 * „Liczy się" (counted) tylko czytanie z sensownym czasem na rozdziale — patrz recordRead.
 */
import { prisma } from "./db";
import { BOOKS } from "@shared/books";
import { dayKey, planStatus } from "@shared/plans";
import {
  BADGES,
  XP,
  computeStreak,
  levelFor,
  minSecondsForChapter,
} from "@shared/gamification";
import type { BadgesDto, ProgressDto, RewardDto } from "@shared/gamification";
import { bestGroupRun } from "./groups";

const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

const RESTORE_COOLDOWN_DAYS = 30;

/**
 * Zapisuje przeczytany rozdział. `seconds` to czas spędzony na stronie (raportuje klient).
 * Rozdział zawsze trafia do postępu, ale do serii/celu/XP liczy się dopiero po minimalnym
 * czasie (ok. 2 s na werset, 6–30 s) — żeby klikanie „przeczytane" nic nie dawało.
 */
export async function recordRead(userId: string, bookId: string, chapter: number, seconds: number) {
  const verses = await prisma.verse.count({ where: { translationId: "WEB", bookId, chapter } });
  const counted = seconds >= minSecondsForChapter(verses);
  const existing = await prisma.readChapter.findUnique({
    where: { userId_bookId_chapter: { userId, bookId, chapter } },
  });
  if (!existing) {
    await prisma.readChapter.create({ data: { userId, bookId, chapter, counted } });
    return counted;
  }
  if (!existing.counted && counted) {
    // Wcześniej odhaczony „na skróty" (albo zbiorczo), teraz naprawdę przeczytany — liczy się od dziś.
    await prisma.readChapter.update({
      where: { userId_bookId_chapter: { userId, bookId, chapter } },
      data: { counted: true, readAt: new Date() },
    });
    return true;
  }
  return existing.counted;
}

interface Facts {
  countedChapters: number;
  completedBooks: Set<string>;
  readByBook: Map<string, Set<number>>; // tylko counted
  countedDays: Map<string, number>; // dzień → liczba rozdziałów
  nightReads: number;
  psalmDays: number;
  notes: number;
  highlights: number;
  plansFinished: number;
  plansOnTrack: number;
  goal: number;
  streak: ReturnType<typeof computeStreak>;
  cards: number;
  reps: number;
  mastered: number;
  understood: number;
  groupMemberships: number;
  groupRun: number;
  learnDue: number;
}

const hourIn = (d: Date, tz: string) =>
  Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: tz }).format(d));

async function loadFacts(userId: string, tz: string): Promise<Facts> {
  const [reads, notes, highlights, plans, goal, restores, cards, understood, groups] = await Promise.all([
    prisma.readChapter.findMany({ where: { userId }, select: { bookId: true, chapter: true, readAt: true, counted: true } }),
    prisma.verseNote.count({ where: { userId } }),
    prisma.highlight.count({ where: { userId } }),
    prisma.readingPlan.findMany({ where: { userId } }),
    prisma.userGoal.findUnique({ where: { userId } }),
    prisma.streakRestore.findMany({ where: { userId } }),
    prisma.learnCard.findMany({ where: { userId }, select: { reps: true, mastered: true, dueAt: true } }),
    prisma.verseCheck.count({ where: { userId, understood: true } }),
    bestGroupRun(userId, tz),
  ]);

  const readByBook = new Map<string, Set<number>>();
  const countedDays = new Map<string, number>();
  const psalmDays = new Set<string>();
  let nightReads = 0;
  let countedChapters = 0;
  for (const r of reads) {
    if (!r.counted) continue;
    countedChapters++;
    const set = readByBook.get(r.bookId) ?? new Set<number>();
    set.add(r.chapter);
    readByBook.set(r.bookId, set);
    const day = dayKey(r.readAt, tz);
    countedDays.set(day, (countedDays.get(day) ?? 0) + 1);
    if (r.bookId === "Ps") psalmDays.add(day);
    const h = hourIn(r.readAt, tz);
    if (h >= 22 || h < 4) nightReads++;
  }
  const completedBooks = new Set(
    BOOKS.filter((b) => (readByBook.get(b.id)?.size ?? 0) >= b.chapterCount).map((b) => b.id),
  );

  // Plany mierzą postęp w tekście, więc liczą wszystkie odhaczone rozdziały (nie tylko counted).
  const readAll = new Set(reads.map((r) => `${r.bookId}:${r.chapter}`));
  const isRead = (c: { bookId: string; chapter: number }) => readAll.has(`${c.bookId}:${c.chapter}`);
  let plansFinished = 0;
  let plansOnTrack = 0;
  for (const p of plans) {
    const st = planStatus(p, isRead, tz);
    if (st.chapters.length > 0 && st.chapters.every(isRead)) plansFinished++;
    else if (st.currentDay >= 7 && !st.finished && st.overdue.length === 0) plansOnTrack++;
  }

  const now = new Date();
  const todayKey = dayKey(now, tz);
  const lastRestore = restores.map((r) => r.createdAt.getTime()).sort((a, b) => b - a)[0];
  const canRestore = !lastRestore || now.getTime() - lastRestore > RESTORE_COOLDOWN_DAYS * 86_400_000;

  return {
    countedChapters,
    completedBooks,
    readByBook,
    countedDays,
    nightReads,
    psalmDays: psalmDays.size,
    notes,
    highlights,
    plansFinished,
    plansOnTrack,
    goal: goal?.dailyChapters ?? 1,
    streak: computeStreak({
      readDays: countedDays.keys(),
      restoreDays: restores.map((r) => r.day),
      todayKey,
      canRestore,
    }),
    cards: cards.length,
    reps: cards.reduce((s, c) => s + c.reps, 0),
    mastered: cards.filter((c) => c.mastered).length,
    understood,
    groupMemberships: groups.memberships,
    groupRun: groups.best,
    learnDue: cards.filter((c) => c.dueAt <= now).length,
  };
}

const countCompleted = (f: Facts, ids: string[]) => ids.filter((id) => f.completedBooks.has(id)).length;
const countTestament = (f: Facts, t: "OT" | "NT") =>
  BOOKS.filter((b) => b.testament === t && f.completedBooks.has(b.id)).length;

/** Wartość licznika każdej odznaki; zdobyta, gdy ≥ target z katalogu. */
function badgeValues(f: Facts): Record<string, number> {
  return {
    "book-first": f.completedBooks.size,
    gospels: countCompleted(f, ["Matt", "Mark", "Luke", "John"]),
    pentateuch: countCompleted(f, ["Gen", "Exod", "Lev", "Num", "Deut"]),
    pauline: countCompleted(f, ["Rom", "1Cor", "2Cor", "Gal", "Eph", "Phil", "Col", "1Thess", "2Thess", "1Tim", "2Tim", "Titus", "Phlm"]),
    psalms: f.readByBook.get("Ps")?.size ?? 0,
    nt: countTestament(f, "NT"),
    ot: countTestament(f, "OT"),
    bible: f.completedBooks.size,
    "streak-7": f.streak.longest,
    "streak-30": f.streak.longest,
    "streak-100": f.streak.longest,
    "streak-365": f.streak.longest,
    "first-note": f.notes,
    "highlights-10": f.highlights,
    "plan-finished": f.plansFinished,
    "plan-on-track": f.plansOnTrack,
    "night-reader": f.nightReads,
    "psalm-days": f.psalmDays,
    "short-books": countCompleted(f, ["Obad", "Phlm", "2John", "3John", "Jude"]),
    "first-card": f.cards,
    "understood-50": f.understood,
    "reviews-50": f.reps,
    "mastered-10": f.mastered,
    "group-joined": f.groupMemberships,
    "group-run-7": f.groupRun,
  };
}

function xpParts(f: Facts) {
  const goalDays = [...f.countedDays.values()].filter((n) => n >= f.goal).length;
  return {
    chapters: f.countedChapters * XP.chapter,
    books: f.completedBooks.size * XP.book,
    goalDays: goalDays * XP.goalDay,
    notes: f.notes * XP.note,
    understood: f.understood * XP.understood,
    mastered: f.mastered * XP.mastered,
  };
}

export async function getProgress(userId: string, tz: string): Promise<ProgressDto> {
  const f = await loadFacts(userId, tz);
  const parts = xpParts(f);
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  const earned = await prisma.userBadge.count({ where: { userId } });
  return {
    level: levelFor(total),
    xp: { total, parts },
    goal: { dailyChapters: f.goal, todayCount: f.countedDays.get(dayKey(new Date(), tz)) ?? 0 },
    streak: f.streak,
    badgesEarned: earned,
    badgesTotal: BADGES.length,
    learn: { total: f.cards, due: f.learnDue, mastered: f.mastered },
  };
}

export async function getBadges(userId: string, tz: string): Promise<BadgesDto> {
  const [f, rows] = await Promise.all([loadFacts(userId, tz), prisma.userBadge.findMany({ where: { userId } })]);
  const earnedAt = new Map(rows.map((r) => [r.badgeId, r.earnedAt.toISOString()]));
  const values = badgeValues(f);
  return {
    badges: BADGES.map((b) => ({
      id: b.id,
      earnedAt: earnedAt.get(b.id) ?? null,
      value: Math.min(values[b.id] ?? 0, b.target),
      target: b.target,
    })),
  };
}

/**
 * Przyznaje odznaki, których warunki są już spełnione, i zwraca nowe (do „celebracji" w UI).
 * Wołane po każdej akcji, która mogła coś odblokować. Nigdy nie odbiera odznak.
 */
export async function syncBadges(userId: string, tz: string): Promise<RewardDto> {
  const [f, have] = await Promise.all([loadFacts(userId, tz), prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } })]);
  const owned = new Set(have.map((b) => b.badgeId));
  const values = badgeValues(f);
  const fresh = BADGES.filter((b) => !owned.has(b.id) && (values[b.id] ?? 0) >= b.target).map((b) => b.id);
  if (fresh.length > 0) {
    await prisma.userBadge.createMany({ data: fresh.map((badgeId) => ({ userId, badgeId })), skipDuplicates: true });
  }
  const total = Object.values(xpParts(f)).reduce((a, b) => a + b, 0);
  return { newBadges: fresh, level: levelFor(total).level };
}

export async function setGoal(userId: string, dailyChapters: number) {
  await prisma.userGoal.upsert({
    where: { userId },
    update: { dailyChapters },
    create: { userId, dailyChapters },
  });
}

/** Przywraca serię: tylko dla dnia, który faktycznie ją ratuje (liczymy to po stronie serwera). */
export async function restoreStreak(userId: string, tz: string, day: string) {
  const f = await loadFacts(userId, tz);
  if (f.streak.restorableDay !== day) throw httpError(400, "Tej serii nie można już przywrócić");
  await prisma.streakRestore.create({ data: { userId, day } });
}

