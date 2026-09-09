import { apiRequest, queryClient } from "./queryClient";
import type {
  BookDto,
  ChapterDto,
  FavoriteDto,
  UserStateDto,
} from "@shared/schema";

export type { BookDto, ChapterDto, FavoriteDto, UserStateDto };

export const qk = {
  books: ["/api/books"] as const,
  chapter: (book: string, chapter: number) => ["/api/chapter", book, chapter] as const,
  state: ["/api/me/state"] as const,
  read: (book?: string) => ["/api/me/read", book ?? "all"] as const,
  favorites: (book?: string, chapter?: number) =>
    ["/api/me/favorites", book ?? "all", chapter ?? "all"] as const,
};

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
}

/** Wyrzuca cudzy stan z pamięci po wylogowaniu — treść biblijna zostaje. */
export function clearUserState() {
  queryClient.removeQueries({ queryKey: qk.state });
  queryClient.removeQueries({ queryKey: ["/api/me/read"] });
  queryClient.removeQueries({ queryKey: ["/api/me/favorites"] });
}
