/**
 * Ranking czytelników: top 10 wg rozdziałów przeczytanych ogółem, dziś i najdłuższej serii.
 * Uczestnictwo jest DOBROWOLNE (User.showOnLeaderboard) — bez zgody nikt nie pojawia się na
 * liście. Liczy się wyłącznie czytanie „counted" (z sensownym czasem na rozdziale), więc
 * samo klikanie „przeczytane" ani zbiorcze odhaczanie nie windują wyniku.
 */
import { prisma } from "./db";
import { dayKey } from "@shared/plans";
import { computeStreak } from "@shared/gamification";
import type { LeaderboardBoard, LeaderboardDto, LeaderboardRow } from "@shared/gamification";

const TOP = 10;

/** Imię do pokazania: pierwszy człon nazwy, przycięty — nigdy adres e-mail. */
const displayName = (name: string) => {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.includes("@") ? first.split("@")[0]!.slice(0, 20) : first.slice(0, 20) || "Czytelnik";
};

function board(entries: { id: string; name: string; value: number }[], meId: string): LeaderboardBoard {
  const sorted = entries
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pl"));
  // Remisy dzielą pozycję (1, 2, 2, 4), żeby kolejność alfabetyczna nie „nagradzała" nikogo.
  const rows: LeaderboardRow[] = [];
  sorted.forEach((e, i) => {
    const rank = i > 0 && sorted[i - 1]!.value === e.value ? rows[i - 1]!.rank : i + 1;
    rows.push({ rank, name: displayName(e.name), value: e.value, isMe: e.id === meId });
  });
  const top = rows.slice(0, TOP);
  // Pozycję zalogowanego dokładamy, gdy wypadł poza pierwsze 10 wierszy (także przy remisie na 1. miejscu).
  const me = rows.slice(TOP).find((r) => r.isMe) ?? null;
  return { top, me };
}

export async function getLeaderboard(userId: string, tz: string): Promise<LeaderboardDto> {
  const [me, participants] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { showOnLeaderboard: true } }),
    prisma.user.findMany({ where: { showOnLeaderboard: true }, select: { id: true, name: true } }),
  ]);
  const ids = participants.map((p) => p.id);
  const [reads, restores] = ids.length
    ? await Promise.all([
        prisma.readChapter.findMany({
          where: { userId: { in: ids }, counted: true },
          select: { userId: true, readAt: true },
        }),
        prisma.streakRestore.findMany({ where: { userId: { in: ids } }, select: { userId: true, day: true } }),
      ])
    : [[], []];

  const today = dayKey(new Date(), tz);
  const total = new Map<string, number>();
  const todayChapters = new Map<string, number>();
  const days = new Map<string, Set<string>>();
  for (const r of reads) {
    total.set(r.userId, (total.get(r.userId) ?? 0) + 1);
    const day = dayKey(r.readAt, tz);
    if (day === today) todayChapters.set(r.userId, (todayChapters.get(r.userId) ?? 0) + 1);
    const set = days.get(r.userId) ?? new Set<string>();
    set.add(day);
    days.set(r.userId, set);
  }
  const restoreBy = new Map<string, string[]>();
  for (const r of restores) restoreBy.set(r.userId, [...(restoreBy.get(r.userId) ?? []), r.day]);

  const streaks = participants.map((p) => ({
    id: p.id,
    name: p.name,
    value: computeStreak({
      readDays: days.get(p.id) ?? [],
      restoreDays: restoreBy.get(p.id) ?? [],
      todayKey: today,
      canRestore: false,
    }).longest,
  }));

  return {
    optedIn: me?.showOnLeaderboard ?? false,
    participants: participants.length,
    chapters: board(participants.map((p) => ({ ...p, value: total.get(p.id) ?? 0 })), userId),
    today: board(participants.map((p) => ({ ...p, value: todayChapters.get(p.id) ?? 0 })), userId),
    streak: board(streaks, userId),
  };
}

export async function setLeaderboardOptIn(userId: string, show: boolean) {
  await prisma.user.update({ where: { id: userId }, data: { showOnLeaderboard: show } });
}
