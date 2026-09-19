/**
 * Tryb nauki: fiszki z wersetów (czytane tłumaczenie → przypomnij sobie odsłaniane) w prostym
 * systemie pudełek Leitnera, „werset dnia" z przeczytanych rozdziałów i odpowiedzi „zrozumiałem".
 */
import { prisma } from "./db";
import { dayKey } from "@shared/plans";
import { DEFAULT_ALT, DEFAULT_READ, resolvePair } from "@shared/translations";
import type { LearnCardDto, LearnDto, Rating, VerseOfDayDto, VerseRefInput } from "@shared/gamification";

/** Struktura rozdziałów i wersetów (numeracja) jest wzorowana na WEB, niezależnie od wybranej pary. */
const REF = "WEB";
const DAY_MS = 86_400_000;
const DUE_BATCH = 20;
/** Odstępy powtórek dla pudełek 1–5 (dni). */
const BOX_DAYS = [0, 1, 3, 7, 14, 30] as const;
const MASTERED_DAYS = 60;

const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });
const after = (ms: number) => new Date(Date.now() + ms);

type Ref = { bookId: string; chapter: number; verse: number };
const key = (r: Ref) => `${r.bookId}:${r.chapter}:${r.verse}`;

type Pair = { read: string; alt: string };

/** Para tłumaczeń wybrana przez użytkownika — fiszki i werset dnia pokazują to samo co czytnik. */
async function userPair(userId: string): Promise<Pair> {
  const [u, translations] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { readTranslation: true, altTranslation: true } }),
    prisma.translation.findMany({ where: { verses: { some: {} } }, select: { id: true } }),
  ]);
  return resolvePair(u?.readTranslation ?? DEFAULT_READ, u?.altTranslation ?? DEFAULT_ALT, translations.map((t) => t.id));
}

async function verseTexts(refs: Ref[], pair: Pair) {
  const out = new Map<string, { text: string; alt: string | null }>();
  if (refs.length === 0) return out;
  const rows = await prisma.verse.findMany({
    where: {
      translationId: { in: [pair.read, pair.alt] },
      OR: refs.map((r) => ({ bookId: r.bookId, chapter: r.chapter, verse: r.verse })),
    },
    select: { translationId: true, bookId: true, chapter: true, verse: true, text: true },
  });
  for (const v of rows) {
    const k = key(v);
    const cur = out.get(k) ?? { text: "", alt: null };
    if (v.translationId === pair.read) cur.text = v.text;
    else cur.alt = v.text;
    out.set(k, cur);
  }
  return out;
}

async function toDtos(
  cards: { bookId: string; chapter: number; verse: number; box: number; mastered: boolean; dueAt: Date }[],
  pair: Pair,
) {
  const texts = await verseTexts(cards, pair);
  return cards.map<LearnCardDto>((c) => ({
    bookId: c.bookId,
    chapter: c.chapter,
    verse: c.verse,
    text: texts.get(key(c))?.text ?? "",
    alt: texts.get(key(c))?.alt ?? null,
    box: c.box,
    mastered: c.mastered,
    dueAt: c.dueAt.toISOString(),
  }));
}

export async function getLearn(userId: string): Promise<LearnDto> {
  const now = new Date();
  const all = await prisma.learnCard.findMany({ where: { userId }, orderBy: { dueAt: "asc" } });
  const due = all.filter((c) => c.dueAt <= now).slice(0, DUE_BATCH);
  const dueTotal = all.filter((c) => c.dueAt <= now).length;
  const pair = await userPair(userId);
  const [dueDtos, cardDtos] = await Promise.all([toDtos(due, pair), toDtos(all, pair)]);
  return {
    due: dueDtos,
    cards: cardDtos,
    totals: { total: all.length, due: dueTotal, mastered: all.filter((c) => c.mastered).length },
  };
}

async function assertVerseExists(ref: Ref) {
  const found = await prisma.verse.findFirst({ where: { translationId: REF, ...ref }, select: { id: true } });
  if (!found) throw httpError(404, "Nie znaleziono wersetu");
}

export async function addCard(userId: string, ref: VerseRefInput) {
  await assertVerseExists(ref);
  await prisma.learnCard.upsert({
    where: { userId_bookId_chapter_verse: { userId, ...ref } },
    update: {},
    create: { userId, ...ref },
  });
}

export async function removeCard(userId: string, ref: VerseRefInput) {
  await prisma.learnCard.deleteMany({ where: { userId, ...ref } });
}

export async function reviewCard(userId: string, ref: VerseRefInput, rating: Rating) {
  const card = await prisma.learnCard.findUnique({ where: { userId_bookId_chapter_verse: { userId, ...ref } } });
  if (!card) throw httpError(404, "Nie ma takiej fiszki");

  let { box, mastered } = card;
  let dueAt: Date;
  if (rating === "again") {
    box = 1;
    mastered = false;
    dueAt = after(10 * 60_000); // wraca jeszcze w tej sesji
  } else if (rating === "hard") {
    dueAt = after(Math.max(1, Math.ceil(BOX_DAYS[box as 1 | 2 | 3 | 4 | 5] / 2)) * DAY_MS);
  } else {
    box += rating === "easy" ? 2 : 1;
    if (mastered || box > 5) {
      // Przeszedł wszystkie pudełka (albo już był „umiem") → opanowany, wraca rzadko, żeby odświeżyć.
      box = 5;
      mastered = true;
      dueAt = after(MASTERED_DAYS * DAY_MS);
    } else {
      dueAt = after(BOX_DAYS[box as 1 | 2 | 3 | 4 | 5] * DAY_MS);
    }
  }
  await prisma.learnCard.update({
    where: { userId_bookId_chapter_verse: { userId, ...ref } },
    data: { box, mastered, dueAt, reps: { increment: 1 } },
  });
}

/** „Umiem" z werseta dnia albo z talii; tworzy fiszkę, jeśli jej jeszcze nie ma. */
export async function setMastered(userId: string, ref: VerseRefInput, mastered: boolean) {
  await assertVerseExists(ref);
  const data = mastered
    ? { mastered: true, box: 5, dueAt: after(MASTERED_DAYS * DAY_MS) }
    : { mastered: false, box: 1, dueAt: new Date() };
  await prisma.learnCard.upsert({
    where: { userId_bookId_chapter_verse: { userId, ...ref } },
    update: data,
    create: { userId, ...ref, ...data },
  });
}

/** Odpowiedź po odsłonięciu tłumaczenia. „Musiałem sprawdzić" dorzuca werset do powtórek. */
export async function checkVerse(userId: string, ref: VerseRefInput, understood: boolean) {
  await assertVerseExists(ref);
  await prisma.verseCheck.upsert({
    where: { userId_bookId_chapter_verse: { userId, ...ref } },
    update: { understood },
    create: { userId, ...ref, understood },
  });
  if (!understood) {
    await prisma.learnCard.upsert({
      where: { userId_bookId_chapter_verse: { userId, ...ref } },
      update: {},
      create: { userId, ...ref },
    });
  }
  return { addedToDeck: !understood };
}

/** FNV-1a — deterministyczny „losowy" wybór, żeby werset dnia był stały przez cały dzień. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Werset dnia: z rozdziału, który użytkownik już czytał (najpierw „naprawdę" przeczytane). */
export async function verseOfDay(userId: string, tz: string): Promise<VerseOfDayDto | null> {
  const reads = await prisma.readChapter.findMany({
    where: { userId },
    select: { bookId: true, chapter: true, counted: true },
    orderBy: [{ bookId: "asc" }, { chapter: "asc" }],
  });
  const pool = reads.some((r) => r.counted) ? reads.filter((r) => r.counted) : reads;
  if (pool.length === 0) return null;

  const seed = `${userId}:${dayKey(new Date(), tz)}`;
  const pick = pool[hash(seed) % pool.length]!;
  const verses = await prisma.verse.findMany({
    where: { translationId: REF, bookId: pick.bookId, chapter: pick.chapter },
    select: { verse: true },
    orderBy: { verse: "asc" },
  });
  if (verses.length === 0) return null;
  const ref: Ref = { bookId: pick.bookId, chapter: pick.chapter, verse: verses[hash(`${seed}:v`) % verses.length]!.verse };

  const [texts, card] = await Promise.all([
    userPair(userId).then((pair) => verseTexts([ref], pair)),
    prisma.learnCard.findUnique({ where: { userId_bookId_chapter_verse: { userId, ...ref } } }),
  ]);
  const t = texts.get(key(ref));
  return { ...ref, text: t?.text ?? "", alt: t?.alt ?? null, inDeck: !!card, mastered: card?.mastered ?? false };
}
