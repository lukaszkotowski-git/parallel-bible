// Schematy Zod do walidacji wejścia API — importuje je tylko serwer (server/routes.ts).
// Osobny moduł, żeby klient, który bierze stałe z ./schema i ./gamification, nie dociągał
// Zoda (~80 KB) do paczki. Typy wejść są re-eksportowane stamtąd jako `export type`.

import { z } from "zod";
import { BOOK_BY_ID } from "./books";
import { RATINGS } from "./gamification";
import { HIGHLIGHT_COLORS, USER_ROLES } from "./schema";

// ---- rozdziały, ulubione, ustawienia ----

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

export const translationPrefsSchema = z.object({
  read: z.string().min(1).max(16),
  alt: z.string().min(1).max(16),
});

export const favoriteInputSchema = chapterRefSchema.extend({
  verseFrom: z.number().int().positive(),
  verseTo: z.number().int().positive().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});
export type FavoriteInput = z.infer<typeof favoriteInputSchema>;

// ---- wyróżnienia i notatki ----

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

// ---- panel administratora ----

export const adminUserPatchSchema = z
  .object({
    role: z.enum(USER_ROLES).optional(),
    emailVerified: z.boolean().optional(),
  })
  .refine((v) => v.role !== undefined || v.emailVerified !== undefined, "Pusta zmiana");
export type AdminUserPatch = z.infer<typeof adminUserPatchSchema>;

// ---- cel dnia i seria ----

export const goalInputSchema = z.object({ dailyChapters: z.number().int().min(1).max(20) });
export const restoreInputSchema = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

// ---- nauka ----

export const verseRefInputSchema = z.object({
  bookId: z.string().min(1).max(16),
  chapter: z.number().int().positive().max(150),
  verse: z.number().int().positive().max(200),
});
export type VerseRefInput = z.infer<typeof verseRefInputSchema>;

export const reviewInputSchema = verseRefInputSchema.extend({ rating: z.enum(RATINGS) });
export const masteredInputSchema = verseRefInputSchema.extend({ mastered: z.boolean() });
export const checkInputSchema = verseRefInputSchema.extend({ understood: z.boolean() });

// ---- grupy ----

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

// ---- ranking ----

export const leaderboardOptSchema = z.object({ show: z.boolean() });
