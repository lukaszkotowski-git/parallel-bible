// Kontrakty API współdzielone przez serwer i klienta.
// Tekst biblijny jest read-only, więc mutowalne są tylko zasoby użytkownika.

import { z } from "zod";

export type { BookRef, Testament } from "./books";
export { BOOKS, BOOK_BY_ID, TOTAL_BOOKS, TOTAL_CHAPTERS } from "./books";
import { BOOK_BY_ID } from "./books";

/** GET /api/books */
export interface BookDto {
  id: string;
  namePl: string;
  shortPl: string;
  nameEn: string;
  testament: "OT" | "NT";
  sortOrder: number;
  chapterCount: number;
}

/** Pojedynczy werset w widoku równoległym. `pl === null` = brak odpowiednika numeracji. */
export interface ParallelVerse {
  v: number;
  en: string;
  pl: string | null;
}

export interface ChapterRef {
  book: string;
  chapter: number;
}

/** GET /api/chapter/:book/:chapter */
export interface ChapterDto {
  book: {
    id: string;
    namePl: string;
    nameEn: string;
    chapter: number;
    totalChapters: number;
  };
  verses: ParallelVerse[];
  /** Wersety obecne po polsku, których nie ma w numeracji angielskiej (ogon rozdziału). */
  extraPl: { v: number; pl: string }[];
  /** Krótkie streszczenie rozdziału (PL/EN), wygenerowane offline. `null` = jeszcze brak. */
  commentary: { en: string; pl: string } | null;
  nav: { prev: ChapterRef | null; next: ChapterRef | null };
  translations: { en: TranslationDto; pl: TranslationDto };
}

export interface TranslationDto {
  id: string;
  name: string;
  shortName: string;
  year: number | null;
  license: string;
  sourceUrl: string | null;
}

/** GET /api/me/state */
export interface UserStateDto {
  position: { bookId: string; namePl: string; chapter: number } | null;
  readCount: number;
  totalChapters: number;
  percent: number; // 0–100, zaokrąglone do 1 miejsca
  favoritesCount: number;
  theme: "light" | "dark";
  role: "user" | "admin";
}

export interface FavoriteDto {
  id: string;
  bookId: string;
  chapter: number;
  verseFrom: number;
  verseTo: number | null;
  note: string | null;
  createdAt: string;
}

// ---- walidacja wejścia ----

export const chapterRefSchema = z.object({
  bookId: z.string().min(1).max(16),
  chapter: z.number().int().positive().max(150),
});
export type ChapterRefInput = z.infer<typeof chapterRefSchema>;

/** Zbiorcze oznaczenie całej księgi: read=true zaznacza wszystkie rozdziały, false odznacza. */
export const bookReadSchema = z.object({
  bookId: z.string().min(1).max(16),
  read: z.boolean(),
});

export const themeSchema = z.object({ theme: z.enum(["light", "dark"]) });

export const favoriteInputSchema = chapterRefSchema.extend({
  verseFrom: z.number().int().positive(),
  verseTo: z.number().int().positive().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});
export type FavoriteInput = z.infer<typeof favoriteInputSchema>;

// ---- wyróżnienia i notatki ----

export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export interface HighlightDto {
  verse: number;
  color: HighlightColor;
}

export interface VerseNoteDto {
  verse: number;
  text: string;
  updatedAt: string;
}

/** GET /api/me/marks?book=&chapter= — wszystko, co użytkownik zaznaczył w rozdziale. */
export interface ChapterMarksDto {
  highlights: HighlightDto[];
  notes: VerseNoteDto[];
  /** Odpowiedzi „zrozumiałem po angielsku / musiałem sprawdzić" (tryb nauki). */
  checks: { verse: number; understood: boolean }[];
  /** Numery wersetów tego rozdziału, które są w talii fiszek. */
  cards: number[];
}

const verseRefSchema = chapterRefSchema.extend({ verse: z.number().int().positive() });

export const highlightInputSchema = verseRefSchema.extend({
  /** `null` = zdejmij wyróżnienie. */
  color: z.enum(HIGHLIGHT_COLORS).nullable(),
});
export type HighlightInput = z.infer<typeof highlightInputSchema>;

export const noteInputSchema = verseRefSchema.extend({
  /** Pusty tekst = usuń notatkę. */
  text: z.string().max(4000),
});
export type NoteInput = z.infer<typeof noteInputSchema>;

/** GET /api/me/notes — lista notatek z całej Biblii (widok „Moje notatki"). */
export interface NoteListItemDto extends VerseNoteDto {
  bookId: string;
  chapter: number;
}

// ---- plany czytania ----

export const planInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  books: z
    .array(z.string())
    .min(1)
    .max(66)
    .refine((b) => b.every((id) => id in BOOK_BY_ID) && new Set(b).size === b.length, "Nieznana lub powtórzona księga"),
  days: z.number().int().min(1).max(1500),
});
export type PlanInput = z.infer<typeof planInputSchema>;

export interface PlanDayDto {
  day: number;
  chapters: { bookId: string; chapter: number; read: boolean }[];
}

/** GET /api/me/plans — postęp liczony po stronie serwera z ReadChapter. */
export interface PlanDto {
  id: string;
  name: string;
  books: string[];
  days: number;
  startedAt: string;
  totalChapters: number;
  readChapters: number;
  /** Dzień kalendarzowy planu (może przekraczać `days`, gdy plan się skończył). */
  currentDay: number;
  /** Rozdziały zaplanowane na dni sprzed dzisiaj, a jeszcze nieprzeczytane (zaległości). */
  overdue: { bookId: string; chapter: number }[];
  /** Dzisiejsza porcja (pusta po zakończeniu planu). */
  today: PlanDayDto | null;
  finished: boolean;
}

// ---- statystyki ----

/** GET /api/me/stats */
export interface StatsDto {
  currentStreak: number;
  longestStreak: number;
  /** Czy dziś (w strefie klienta) coś już przeczytano — do „streak w niebezpieczeństwie". */
  readToday: boolean;
  totalRead: number;
  /** Dzień (YYYY-MM-DD) → liczba rozdziałów oznaczonych jako przeczytane. Ostatnie ~26 tygodni. */
  daily: Record<string, number>;
  /** Księga → numery przeczytanych rozdziałów (mapa cieplna 66 ksiąg). */
  byBook: Record<string, number[]>;
}

// ---- panel administratora ----

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Wiersz listy użytkowników. Tylko liczniki — treść notatek i ulubionych jest prywatna. */
export interface AdminUserDto {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  createdAt: string;
  /** Ostatnia aktywność: późniejsza z ostatniej sesji i ostatniego oznaczenia rozdziału. */
  lastActiveAt: string | null;
  /** "credential" (e-mail+hasło) i/lub "google". */
  providers: string[];
  counts: { read: number; favorites: number; notes: number; highlights: number; plans: number };
}

/** GET /api/admin/users */
export interface AdminUsersDto {
  users: AdminUserDto[];
  total: number;
  page: number;
  pageSize: number;
  summary: { total: number; verified: number; admins: number; newLast7d: number; activeLast7d: number };
}

export const adminUserPatchSchema = z
  .object({
    role: z.enum(USER_ROLES).optional(),
    emailVerified: z.boolean().optional(),
  })
  .refine((v) => v.role !== undefined || v.emailVerified !== undefined, "Pusta zmiana");
export type AdminUserPatch = z.infer<typeof adminUserPatchSchema>;
