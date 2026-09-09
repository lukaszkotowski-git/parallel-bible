// Kontrakty API współdzielone przez serwer i klienta.
// Tekst biblijny jest read-only, więc mutowalne są tylko zasoby użytkownika.

import { z } from "zod";

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

export const themeSchema = z.object({ theme: z.enum(["light", "dark"]) });

export const favoriteInputSchema = chapterRefSchema.extend({
  verseFrom: z.number().int().positive(),
  verseTo: z.number().int().positive().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});
export type FavoriteInput = z.infer<typeof favoriteInputSchema>;
