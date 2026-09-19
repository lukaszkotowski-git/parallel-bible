// Plany czytania: deterministyczny podział rozdziałów wybranych ksiąg na dni.
// Plan w bazie to tylko { books, days, startedAt } — reszta wynika stąd i z ReadChapter,
// więc klient i serwer liczą dokładnie to samo.

import { BOOK_BY_ID, BOOKS } from "./books";

export interface PlanChapter {
  bookId: string;
  chapter: number;
}

export interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  books: string[];
  days: number;
}

const ids = (testament?: "OT" | "NT") =>
  BOOKS.filter((b) => !testament || b.testament === testament).map((b) => b.id);

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: "bible-year",
    name: "Biblia w rok",
    description: "Wszystkie 66 ksiąg w kolejności kanonu, ok. 3–4 rozdziały dziennie.",
    books: ids(),
    days: 365,
  },
  {
    id: "nt-90",
    name: "Nowy Testament w 90 dni",
    description: "260 rozdziałów, ok. 3 dziennie.",
    books: ids("NT"),
    days: 90,
  },
  {
    id: "gospels-30",
    name: "Ewangelie w 30 dni",
    description: "Mateusz, Marek, Łukasz i Jan — ok. 3 rozdziały dziennie.",
    books: ["Matt", "Mark", "Luke", "John"],
    days: 30,
  },
  {
    id: "psalms-30",
    name: "Psalmy w miesiąc",
    description: "150 psalmów, 5 dziennie.",
    books: ["Ps"],
    days: 30,
  },
  {
    id: "proverbs-31",
    name: "Przypowieści w 31 dni",
    description: "Jeden rozdział dziennie — po jednym na każdy dzień miesiąca.",
    books: ["Prov"],
    days: 31,
  },
];

/** Wszystkie rozdziały planu w kolejności czytania. Nieznane księgi są pomijane. */
export function planChapters(books: string[]): PlanChapter[] {
  const out: PlanChapter[] = [];
  for (const bookId of books) {
    const book = BOOK_BY_ID[bookId];
    if (!book) continue;
    for (let chapter = 1; chapter <= book.chapterCount; chapter++) out.push({ bookId, chapter });
  }
  return out;
}

/** Rozdziały przypadające na dzień `day` (1-based) — równy podział, różnica ≤ 1 rozdział. */
export function chaptersForDay(chapters: PlanChapter[], days: number, day: number): PlanChapter[] {
  if (day < 1 || day > days) return [];
  const n = chapters.length;
  return chapters.slice(Math.floor(((day - 1) * n) / days), Math.floor((day * n) / days));
}

const DAY_MS = 86_400_000;

/** Poprawna strefa IANA albo "UTC" — nie ufamy parametrowi z zapytania. */
export function safeTimeZone(tz: unknown): string {
  if (typeof tz !== "string" || !tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Dzień kalendarzowy `d` w strefie `tz` jako "YYYY-MM-DD". */
export function dayKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Różnica w dniach kalendarzowych między dwoma kluczami "YYYY-MM-DD" (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** Numer dnia planu (1-based). Przed startem = 1, po końcu > days. */
export function currentPlanDay(startKey: string, todayKey: string): number {
  return Math.max(1, daysBetween(startKey, todayKey) + 1);
}

export interface PlanStatus {
  chapters: PlanChapter[];
  currentDay: number;
  finished: boolean;
  /** Rozdziały zaplanowane na dni sprzed dzisiaj, a nieprzeczytane. */
  overdue: PlanChapter[];
  today: PlanChapter[];
}

/** Stan planu na „dziś" w strefie `tz` — wspólne dla planów osobistych i grupowych. */
export function planStatus(
  cfg: { books: string[]; days: number; startedAt: Date },
  isRead: (c: PlanChapter) => boolean,
  tz: string,
  now: Date = new Date(),
): PlanStatus {
  const chapters = planChapters(cfg.books);
  const n = chapters.length;
  const currentDay = currentPlanDay(dayKey(cfg.startedAt, tz), dayKey(now, tz));
  const overdueUntil = Math.floor((Math.min(currentDay - 1, cfg.days) * n) / cfg.days);
  const finished = currentDay > cfg.days;
  return {
    chapters,
    currentDay,
    finished,
    overdue: chapters.slice(0, overdueUntil).filter((c) => !isRead(c)),
    today: finished ? [] : chaptersForDay(chapters, cfg.days, currentDay),
  };
}
