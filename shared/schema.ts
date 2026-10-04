// Kontrakty API współdzielone przez serwer i klienta.
// Tekst biblijny jest read-only, więc mutowalne są tylko zasoby użytkownika.

export type { BookRef, Testament } from "./books";
export { BOOKS, BOOK_BY_ID, TOTAL_BOOKS, TOTAL_CHAPTERS } from "./books";

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

/**
 * Pojedynczy werset w widoku równoległym: `text` to tłumaczenie czytane ciągiem, `alt` to
 * odsłaniane po kliknięciu. `alt === null` = brak odpowiednika numeracji.
 */
export interface ParallelVerse {
  v: number;
  text: string;
  alt: string | null;
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
  /** Wersety obecne tylko w tłumaczeniu odsłanianym, bez odpowiednika w czytanym (ogon rozdziału). */
  extraAlt: { v: number; alt: string }[];
  /** Krótkie streszczenie rozdziału (PL/EN), wygenerowane offline — tylko w tych dwóch językach. */
  commentary: { en: string; pl: string } | null;
  nav: { prev: ChapterRef | null; next: ChapterRef | null };
  translations: { read: TranslationDto; alt: TranslationDto };
}

export interface TranslationDto {
  id: string;
  language: string; // kod ISO: "en" | "pl" | "es"
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
  readTranslation: string; // Translation.id czytane ciągiem
  altTranslation: string; // Translation.id odsłaniane po kliknięciu
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
// Schematy Zod żyją w ./validation (importuje je tylko serwer), tu zostają same typy —
// dzięki temu klient, który bierze stąd stałe (HIGHLIGHT_COLORS), nie ciągnie Zoda do paczki.
export type {
  AdminUserPatch,
  ChapterRefInput,
  FavoriteInput,
  HighlightInput,
  NoteInput,
  PlanInput,
} from "./validation";


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
  /** Odpowiedzi „zrozumiałem / musiałem sprawdzić" (tryb nauki). */
  checks: { verse: number; understood: boolean }[];
  /** Numery wersetów tego rozdziału, które są w talii fiszek. */
  cards: number[];
}


/** GET /api/me/notes — lista notatek z całej Biblii (widok „Moje notatki"). */
export interface NoteListItemDto extends VerseNoteDto {
  bookId: string;
  chapter: number;
}

// ---- plany czytania ----


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


/** Dane do dobrowolnego wsparcia (GET /api/config). Numery są same cyframi — formatowanie robi klient. */
export interface SupportConfig {
  /** Numer telefonu do BLIK na telefon (9 cyfr) albo null. */
  phone: string | null;
  /** Numer rachunku (26 cyfr bez „PL") albo null. */
  account: string | null;
  /** Tytuł przelewu do skopiowania. */
  title: string;
  /** Nazwa odbiorcy (opcjonalnie). */
  recipient: string | null;
}
