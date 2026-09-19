// Gamifikacja: poziomy, katalog odznak, seria z ochroną i kontrakty API.
// Ton jest spokojny — nagradzamy regularność i głębię, nie tempo. XP, poziomy i postęp odznak
// są zawsze wyliczane z danych (nie ma osobnego licznika, który mógłby się rozjechać).

import { z } from "zod";

// ---------- XP i poziomy ----------

export const XP = {
  chapter: 10, // rozdział przeczytany „naprawdę" (counted)
  book: 50, // księga w całości przeczytana „naprawdę"
  goalDay: 5, // dzień, w którym osiągnięto cel dzienny
  note: 2,
  understood: 1, // werset zrozumiany po angielsku (raz na werset)
  mastered: 15, // werset „umiem”
} as const;

/** Minimalny czas na rozdziale, by liczył się do serii/celu/XP: ok. 2 s na werset, 6–30 s. */
export const minSecondsForChapter = (verseCount: number) => Math.min(30, Math.max(6, verseCount * 2));

export const LEVELS = [
  { level: 1, name: "Szukający", xp: 0 },
  { level: 2, name: "Słuchacz", xp: 100 },
  { level: 3, name: "Uczeń", xp: 300 },
  { level: 4, name: "Pilny czytelnik", xp: 700 },
  { level: 5, name: "Skryba", xp: 1500 },
  { level: 6, name: "Mędrzec", xp: 3000 },
  { level: 7, name: "Strażnik Słowa", xp: 6000 },
] as const;

export interface LevelInfo {
  level: number;
  name: string;
  xp: number;
  /** XP na progu bieżącego poziomu i następnego (null na najwyższym). */
  floor: number;
  ceil: number | null;
  /** 0–1 postępu do następnego poziomu (1 na najwyższym). */
  progress: number;
}

export function levelFor(xp: number): LevelInfo {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]!.xp) idx = i;
  const cur = LEVELS[idx]!;
  const next = LEVELS[idx + 1];
  return {
    level: cur.level,
    name: cur.name,
    xp,
    floor: cur.xp,
    ceil: next?.xp ?? null,
    progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1,
  };
}

// ---------- seria z ochroną ----------

const DAY_MS = 86_400_000;

/** Dodaje `n` dni do klucza „YYYY-MM-DD" (arytmetyka kalendarzowa w UTC — bez pułapek DST). */
export function addDays(key: string, n: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Poniedziałek tygodnia, do którego należy dzień (klucz tygodnia ISO). */
export function weekKey(key: string): string {
  const dow = (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7; // pn = 0
  return addDays(key, -dow);
}

export interface StreakResult {
  current: number;
  longest: number;
  readToday: boolean;
  /** Czy w bieżącym tygodniu „dzień oddechu" jest jeszcze do wykorzystania. */
  restDayAvailable: boolean;
  /** Dzień, który można jeszcze odzyskać (≤ 48 h wstecz), albo null. */
  restorableDay: string | null;
}

function walk(covered: Set<string>, today: string) {
  let first: string | null = null;
  for (const d of covered) if (first === null || d < first) first = d;
  let cur = 0;
  let longest = 0;
  const usedWeeks = new Set<string>();
  if (first !== null) {
    for (let d = first; d <= today; d = addDays(d, 1)) {
      if (covered.has(d)) {
        cur++;
        longest = Math.max(longest, cur);
      } else if (d === today) {
        // Dziś jeszcze można przeczytać — brak czytania dziś niczego nie przerywa.
      } else if (cur > 0 && !usedWeeks.has(weekKey(d))) {
        // „Dzień oddechu": jeden opuszczony dzień w tygodniu nie przerywa serii.
        usedWeeks.add(weekKey(d));
      } else {
        cur = 0;
        usedWeeks.clear();
      }
    }
  }
  return { cur, longest, usedWeeks };
}

/**
 * Seria dni czytania.
 * - `readDays`: dni z zaliczonym czytaniem; `restoreDays`: dni odzyskane przywróceniem.
 * - Jeden opuszczony dzień w każdym tygodniu (pn–nd) jest wybaczany automatycznie.
 * - Jeśli seria pękła w ciągu ostatnich 48 h, a jeden dzień ją ratuje, zwracamy go jako
 *   `restorableDay` (o ile `canRestore`, czyli nie było przywrócenia w ostatnich 30 dniach).
 */
export function computeStreak(opts: {
  readDays: Iterable<string>;
  restoreDays: Iterable<string>;
  todayKey: string;
  canRestore: boolean;
}): StreakResult {
  const read = new Set(opts.readDays);
  const covered = new Set([...read, ...opts.restoreDays]);
  const { cur, longest, usedWeeks } = walk(covered, opts.todayKey);

  let restorableDay: string | null = null;
  if (opts.canRestore && cur === 0 && covered.size > 0) {
    for (const m of [addDays(opts.todayKey, -2), addDays(opts.todayKey, -1)]) {
      if (covered.has(m)) continue;
      if (walk(new Set([...covered, m]), opts.todayKey).cur >= 3) {
        restorableDay = m;
        break;
      }
    }
  }

  return {
    current: cur,
    longest,
    readToday: read.has(opts.todayKey),
    restDayAvailable: !usedWeeks.has(weekKey(opts.todayKey)),
    restorableDay,
  };
}

// ---------- odznaki ----------

export type BadgeCategory = "books" | "streak" | "depth" | "curious" | "learn" | "together";

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  /** Nazwa ikony lucide-react (mapowana po stronie klienta). */
  icon: string;
  /** Odznaka jest zdobyta, gdy wartość licznika (liczona na serwerze) ≥ target. */
  target: number;
}

export const CATEGORY_LABEL: Record<BadgeCategory, string> = {
  books: "Księgi",
  streak: "Regularność",
  depth: "Głębia",
  curious: "Ciekawostki",
  learn: "Nauka",
  together: "Razem",
};

export const BADGES: BadgeDef[] = [
  { id: "book-first", name: "Pierwsza księga", description: "Przeczytaj w całości dowolną księgę.", category: "books", icon: "BookOpen", target: 1 },
  { id: "gospels", name: "Cztery Ewangelie", description: "Przeczytaj Mateusza, Marka, Łukasza i Jana.", category: "books", icon: "Cross", target: 4 },
  { id: "pentateuch", name: "Pięcioksiąg", description: "Przeczytaj księgi od Rodzaju do Powtórzonego Prawa.", category: "books", icon: "Scroll", target: 5 },
  { id: "pauline", name: "Listy Pawła", description: "Przeczytaj wszystkie 13 listów Pawła.", category: "books", icon: "Mail", target: 13 },
  { id: "psalms", name: "Księga Psalmów", description: "Przeczytaj wszystkie 150 psalmów.", category: "books", icon: "Music", target: 150 },
  { id: "nt", name: "Nowy Testament", description: "Przeczytaj wszystkie 27 ksiąg Nowego Testamentu.", category: "books", icon: "Sunrise", target: 27 },
  { id: "ot", name: "Stary Testament", description: "Przeczytaj wszystkie 39 ksiąg Starego Testamentu.", category: "books", icon: "Mountain", target: 39 },
  { id: "bible", name: "Cała Biblia", description: "Przeczytaj wszystkie 66 ksiąg.", category: "books", icon: "Crown", target: 66 },

  { id: "streak-7", name: "Tydzień", description: "Seria 7 dni czytania.", category: "streak", icon: "Flame", target: 7 },
  { id: "streak-30", name: "Miesiąc", description: "Seria 30 dni czytania.", category: "streak", icon: "Flame", target: 30 },
  { id: "streak-100", name: "Sto dni", description: "Seria 100 dni czytania.", category: "streak", icon: "Flame", target: 100 },
  { id: "streak-365", name: "Cały rok", description: "Seria 365 dni czytania.", category: "streak", icon: "Flame", target: 365 },

  { id: "first-note", name: "Pierwsza notatka", description: "Zapisz swoją pierwszą notatkę do wersetu.", category: "depth", icon: "StickyNote", target: 1 },
  { id: "highlights-10", name: "Zakreślacz", description: "Wyróżnij 10 wersetów.", category: "depth", icon: "Highlighter", target: 10 },
  { id: "plan-finished", name: "Plan ukończony", description: "Przeczytaj do końca cały plan czytania.", category: "depth", icon: "CalendarCheck", target: 1 },
  { id: "plan-on-track", name: "Bez zaległości", description: "Bądź na bieżąco z planem po co najmniej 7 dniach.", category: "depth", icon: "CircleCheck", target: 1 },

  { id: "night-reader", name: "Nocny czytelnik", description: "Przeczytaj rozdział między 22:00 a 4:00.", category: "curious", icon: "Moon", target: 1 },
  { id: "psalm-days", name: "Psalm po psalmie", description: "Czytaj Psalmy w 30 różnych dniach.", category: "curious", icon: "Music", target: 30 },
  { id: "short-books", name: "Krótkie księgi", description: "Przeczytaj Abdiasza, Filemona, 2 i 3 Jana oraz Judy.", category: "curious", icon: "Feather", target: 5 },

  { id: "first-card", name: "Pierwsza fiszka", description: "Dodaj werset do powtórek.", category: "learn", icon: "Layers", target: 1 },
  { id: "understood-50", name: "Rozumiem po angielsku", description: "Zrozum 50 wersetów bez zaglądania do polskiego.", category: "learn", icon: "Languages", target: 50 },
  { id: "reviews-50", name: "Powtórki", description: "Wykonaj 50 powtórek fiszek.", category: "learn", icon: "Repeat", target: 50 },
  { id: "mastered-10", name: "Znam na pamięć", description: "Opanuj 10 wersetów (przycisk „umiem”).", category: "learn", icon: "Brain", target: 10 },

  { id: "group-joined", name: "Razem", description: "Dołącz do grupy czytelniczej.", category: "together", icon: "Users", target: 1 },
  { id: "group-run-7", name: "Wspólny tydzień", description: "Czytajcie razem w grupie przez 7 dni z rzędu.", category: "together", icon: "HeartHandshake", target: 7 },
];

export const BADGE_BY_ID: Record<string, BadgeDef> = Object.fromEntries(BADGES.map((b) => [b.id, b]));

// ---------- kontrakty API ----------

export interface BadgeProgressDto {
  id: string;
  earnedAt: string | null;
  value: number; // ograniczone do target
  target: number;
}

/** GET /api/me/progress */
export interface ProgressDto {
  level: LevelInfo;
  xp: { total: number; parts: { chapters: number; books: number; goalDays: number; notes: number; understood: number; mastered: number } };
  goal: { dailyChapters: number; todayCount: number };
  streak: StreakResult;
  badgesEarned: number;
  badgesTotal: number;
  learn: { total: number; due: number; mastered: number };
}

/** GET /api/me/badges */
export interface BadgesDto {
  badges: BadgeProgressDto[];
}

/** Odpowiedź akcji, które mogą coś przyznać: nowe odznaki + aktualny poziom (do „awansu"). */
export interface RewardDto {
  newBadges: string[];
  level: number;
}

export const goalInputSchema = z.object({ dailyChapters: z.number().int().min(1).max(20) });
export const restoreInputSchema = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

// ---------- nauka ----------

export const verseRefInputSchema = z.object({
  bookId: z.string().min(1).max(16),
  chapter: z.number().int().positive().max(150),
  verse: z.number().int().positive().max(200),
});
export type VerseRefInput = z.infer<typeof verseRefInputSchema>;

export const RATINGS = ["again", "hard", "good", "easy"] as const;
export type Rating = (typeof RATINGS)[number];
export const reviewInputSchema = verseRefInputSchema.extend({ rating: z.enum(RATINGS) });
export const masteredInputSchema = verseRefInputSchema.extend({ mastered: z.boolean() });
export const checkInputSchema = verseRefInputSchema.extend({ understood: z.boolean() });

export interface LearnCardDto {
  bookId: string;
  chapter: number;
  verse: number;
  en: string;
  pl: string | null;
  box: number;
  mastered: boolean;
  dueAt: string;
}

/** GET /api/me/learn */
export interface LearnDto {
  due: LearnCardDto[];
  cards: LearnCardDto[];
  totals: { total: number; due: number; mastered: number };
}

/** GET /api/me/verse-of-day */
export interface VerseOfDayDto {
  bookId: string;
  chapter: number;
  verse: number;
  en: string;
  pl: string | null;
  inDeck: boolean;
  mastered: boolean;
}

// ---------- grupy ----------

export const groupPlanSchema = z.object({
  name: z.string().trim().min(1).max(80),
  books: z.array(z.string()).min(1).max(66),
  days: z.number().int().min(1).max(1500),
});
export const groupCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
});
export const groupPatchSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  /** null = usuń wspólny plan. */
  plan: groupPlanSchema.nullable().optional(),
});
export const groupJoinSchema = z.object({ code: z.string().trim().min(4).max(32) });

export interface GroupSummaryDto {
  id: string;
  name: string;
  memberCount: number;
  readToday: number;
  isOwner: boolean;
  hasPlan: boolean;
}

export interface GroupMemberDto {
  userId: string;
  name: string;
  isOwner: boolean;
  isMe: boolean;
  /** Tylko fakt „dziś czytał(a)" — bez liczb, żeby nie zachęcać do porównywania. */
  readToday: boolean;
  /** Tylko przy wspólnym planie: czy członek jest na bieżąco. */
  onTrack: boolean | null;
}

/** GET /api/me/groups/:id */
export interface GroupDetailDto {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  isOwner: boolean;
  members: GroupMemberDto[];
  readToday: number;
  /** Dni z rzędu, w których co najmniej połowa grupy czytała. */
  sharedRun: { current: number; best: number };
  plan: {
    name: string;
    books: string[];
    days: number;
    startedAt: string;
    currentDay: number;
    finished: boolean;
    today: { bookId: string; chapter: number; read: boolean }[];
    myOverdue: number;
  } | null;
}

// ---------- ranking ----------

export interface LeaderboardRow {
  rank: number;
  /** Tylko imię (pierwszy człon nazwy) — bez e-maila. */
  name: string;
  value: number;
  isMe: boolean;
}

export interface LeaderboardBoard {
  top: LeaderboardRow[];
  /** Pozycja zalogowanego, gdy uczestniczy w rankingu, a nie mieści się w top 10. */
  me: LeaderboardRow | null;
}

/** GET /api/me/leaderboard — czytanie liczone tylko z „prawdziwie" przeczytanych rozdziałów. */
export interface LeaderboardDto {
  /** Czy zalogowany użytkownik wyraził zgodę na pokazywanie się w rankingu. */
  optedIn: boolean;
  participants: number;
  /** Liczba przeczytanych rozdziałów w ogóle. */
  chapters: LeaderboardBoard;
  /** Liczba rozdziałów przeczytanych dzisiaj. */
  today: LeaderboardBoard;
  /** Najdłuższa seria dni czytania. */
  streak: LeaderboardBoard;
}

export const leaderboardOptSchema = z.object({ show: z.boolean() });
