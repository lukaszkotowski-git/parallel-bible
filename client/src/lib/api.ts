import { apiRequest, queryClient } from "./queryClient";
import type {
  BookDto,
  ChapterDto,
  ChapterMarksDto,
  FavoriteDto,
  HighlightColor,
  NoteListItemDto,
  PlanDto,
  PlanInput,
  StatsDto,
  UserStateDto,
} from "@shared/schema";

export type {
  BookDto,
  ChapterDto,
  ChapterMarksDto,
  FavoriteDto,
  HighlightColor,
  NoteListItemDto,
  PlanDto,
  PlanInput,
  StatsDto,
  UserStateDto,
};

/** Strefa użytkownika — serwer liczy „dziś", serie i dzień planu w jego kalendarzu. */
export const userTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const qk = {
  books: ["/api/books"] as const,
  chapter: (book: string, chapter: number) => ["/api/chapter", book, chapter] as const,
  state: ["/api/me/state"] as const,
  read: (book?: string) => ["/api/me/read", book ?? "all"] as const,
  favorites: (book?: string, chapter?: number) =>
    ["/api/me/favorites", book ?? "all", chapter ?? "all"] as const,
  marks: (book: string, chapter: number) => ["/api/me/marks", book, chapter] as const,
  notes: ["/api/me/notes"] as const,
  plans: ["/api/me/plans"] as const,
  stats: ["/api/me/stats"] as const,
};

export async function fetchMarks(book: string, chapter: number) {
  const res = await apiRequest("GET", `/api/me/marks?book=${book}&chapter=${chapter}`);
  return (await res.json()) as ChapterMarksDto;
}

export async function saveHighlight(
  bookId: string,
  chapter: number,
  verse: number,
  color: HighlightColor | null,
) {
  await apiRequest("PUT", "/api/me/highlights", { bookId, chapter, verse, color });
}

export async function saveNote(bookId: string, chapter: number, verse: number, text: string) {
  await apiRequest("PUT", "/api/me/notes", { bookId, chapter, verse, text });
}

export async function fetchNotes() {
  const res = await apiRequest("GET", "/api/me/notes");
  return (await res.json()) as NoteListItemDto[];
}

export async function fetchPlans() {
  const res = await apiRequest("GET", `/api/me/plans?tz=${encodeURIComponent(userTimeZone())}`);
  return (await res.json()) as PlanDto[];
}

export async function createPlan(input: PlanInput) {
  await apiRequest("POST", "/api/me/plans", input);
}

export async function deletePlan(id: string) {
  await apiRequest("DELETE", `/api/me/plans/${id}`);
}

export async function fetchStats() {
  const res = await apiRequest("GET", `/api/me/stats?tz=${encodeURIComponent(userTimeZone())}`);
  return (await res.json()) as StatsDto;
}

export async function fetchReadChapters(book?: string) {
  const res = await apiRequest("GET", `/api/me/read${book ? `?book=${book}` : ""}`);
  return (await res.json()) as { bookId: string; chapter: number }[];
}

export async function fetchFavorites(book?: string, chapter?: number) {
  const params = new URLSearchParams();
  if (book) params.set("book", book);
  if (chapter) params.set("chapter", String(chapter));
  const suffix = params.toString() ? `?${params}` : "";
  const res = await apiRequest("GET", `/api/me/favorites${suffix}`);
  return (await res.json()) as FavoriteDto[];
}

export async function markRead(bookId: string, chapter: number) {
  await apiRequest("POST", "/api/me/read", { bookId, chapter });
}

export async function unmarkRead(bookId: string, chapter: number) {
  await apiRequest("DELETE", "/api/me/read", { bookId, chapter });
}

export async function savePosition(bookId: string, chapter: number) {
  await apiRequest("PUT", "/api/me/position", { bookId, chapter });
}

export async function addFavorite(bookId: string, chapter: number, verseFrom: number) {
  await apiRequest("POST", "/api/me/favorites", { bookId, chapter, verseFrom });
}

export async function removeFavorite(bookId: string, chapter: number, verseFrom: number) {
  await apiRequest("DELETE", "/api/me/favorites", { bookId, chapter, verseFrom });
}

export async function saveTheme(theme: "light" | "dark") {
  await apiRequest("PUT", "/api/me/theme", { theme });
}

/** Odświeża wszystko, co zależy od stanu użytkownika. */
export function invalidateUserState() {
  queryClient.invalidateQueries({ queryKey: qk.state });
  queryClient.invalidateQueries({ queryKey: ["/api/me/read"] });
  queryClient.invalidateQueries({ queryKey: ["/api/me/favorites"] });
  // Plany i statystyki wynikają z ReadChapter, więc odświeżają się razem z postępem.
  queryClient.invalidateQueries({ queryKey: qk.plans });
  queryClient.invalidateQueries({ queryKey: qk.stats });
}

/** Wyróżnienia i notatki — osobno, żeby zapis koloru nie przeładowywał planów i statystyk. */
export function invalidateMarks() {
  queryClient.invalidateQueries({ queryKey: ["/api/me/marks"] });
  queryClient.invalidateQueries({ queryKey: qk.notes });
}

/** Wyrzuca cudzy stan z pamięci po wylogowaniu — treść biblijna zostaje. */
export function clearUserState() {
  queryClient.removeQueries({ queryKey: qk.state });
  queryClient.removeQueries({ queryKey: ["/api/me/read"] });
  queryClient.removeQueries({ queryKey: ["/api/me/favorites"] });
  queryClient.removeQueries({ queryKey: ["/api/me/marks"] });
  queryClient.removeQueries({ queryKey: qk.notes });
  queryClient.removeQueries({ queryKey: qk.plans });
  queryClient.removeQueries({ queryKey: qk.stats });
}
