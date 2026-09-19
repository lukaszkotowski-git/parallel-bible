import { apiRequest, queryClient } from "./queryClient";
import type {
  BadgesDto,
  GroupDetailDto,
  GroupSummaryDto,
  LeaderboardDto,
  LearnDto,
  ProgressDto,
  Rating,
  RewardDto,
  VerseOfDayDto,
  VerseRefInput,
} from "@shared/gamification";
import type {
  AdminUserPatch,
  AdminUsersDto,
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
  BadgesDto,
  GroupDetailDto,
  GroupSummaryDto,
  LeaderboardDto,
  LearnDto,
  ProgressDto,
  Rating,
  RewardDto,
  VerseOfDayDto,
  VerseRefInput,
  AdminUserPatch,
  AdminUsersDto,
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
  progress: ["/api/me/progress"] as const,
  badges: ["/api/me/badges"] as const,
  learn: ["/api/me/learn"] as const,
  verseOfDay: ["/api/me/verse-of-day"] as const,
  groups: ["/api/me/groups"] as const,
  leaderboard: ["/api/me/leaderboard"] as const,
  group: (id: string) => ["/api/me/groups", id] as const,
  adminUsers: (q: string, page: number) => ["/api/admin/users", q, page] as const,
};

export async function fetchAdminUsers(q: string, page: number) {
  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set("q", q);
  const res = await apiRequest("GET", `/api/admin/users?${params}`);
  return (await res.json()) as AdminUsersDto;
}

export async function patchAdminUser(id: string, patch: AdminUserPatch) {
  await apiRequest("PATCH", `/api/admin/users/${id}`, patch);
}

export async function revokeUserSessions(id: string) {
  await apiRequest("POST", `/api/admin/users/${id}/revoke-sessions`);
}

export async function deleteAdminUser(id: string) {
  await apiRequest("DELETE", `/api/admin/users/${id}`);
}

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
  const res = await apiRequest("PUT", "/api/me/highlights", { bookId, chapter, verse, color });
  return (await res.json()) as RewardDto;
}

export async function saveNote(bookId: string, chapter: number, verse: number, text: string) {
  const res = await apiRequest("PUT", "/api/me/notes", { bookId, chapter, verse, text });
  return (await res.json()) as RewardDto;
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
  const res = await apiRequest("POST", "/api/me/plans", input);
  return (await res.json()) as RewardDto;
}

export async function deletePlan(id: string) {
  await apiRequest("DELETE", `/api/me/plans/${id}`);
}

// ---- gamifikacja ----

const json = async <T,>(method: string, url: string, body?: unknown) =>
  (await (await apiRequest(method, url, body)).json()) as T;

export const fetchProgress = () => json<ProgressDto>("GET", "/api/me/progress");
export const fetchBadges = () => json<BadgesDto>("GET", "/api/me/badges");
export const saveGoal = (dailyChapters: number) => json<{ ok: true }>("PUT", "/api/me/goal", { dailyChapters });
export const restoreStreak = (day: string) => json<{ ok: true }>("POST", "/api/me/streak/restore", { day });

export const fetchLeaderboard = () => json<LeaderboardDto>("GET", "/api/me/leaderboard");
export const setLeaderboardOptIn = (show: boolean) => json<{ ok: true }>("PUT", "/api/me/leaderboard/opt", { show });

// ---- nauka ----

export const fetchLearn = () => json<LearnDto>("GET", "/api/me/learn");
export const fetchVerseOfDay = () => json<VerseOfDayDto | null>("GET", "/api/me/verse-of-day");
export const addLearnCard = (ref: VerseRefInput) => json<RewardDto>("POST", "/api/me/learn/cards", ref);
export const removeLearnCard = (ref: VerseRefInput) => json<{ ok: true }>("DELETE", "/api/me/learn/cards", ref);
export const reviewLearnCard = (ref: VerseRefInput, rating: Rating) =>
  json<RewardDto>("POST", "/api/me/learn/review", { ...ref, rating });
export const setLearnMastered = (ref: VerseRefInput, mastered: boolean) =>
  json<RewardDto>("PUT", "/api/me/learn/mastered", { ...ref, mastered });
export const checkVerse = (ref: VerseRefInput, understood: boolean) =>
  json<RewardDto & { addedToDeck: boolean }>("PUT", "/api/me/learn/check", { ...ref, understood });

// ---- grupy ----

export const fetchGroups = () => json<GroupSummaryDto[]>("GET", "/api/me/groups");
export const fetchGroup = (id: string) => json<GroupDetailDto>("GET", `/api/me/groups/${id}`);
export const createGroup = (name: string, description?: string) =>
  json<RewardDto & { id: string }>("POST", "/api/me/groups", { name, description });
export const joinGroup = (code: string) => json<RewardDto & { id: string }>("POST", "/api/me/groups/join", { code });
export const patchGroup = (id: string, patch: unknown) => json<{ ok: true }>("PATCH", `/api/me/groups/${id}`, patch);
export const regenerateGroupCode = (id: string) => json<{ ok: true }>("POST", `/api/me/groups/${id}/regenerate-code`);
export const removeGroupMember = (id: string, userId: string) =>
  json<{ ok: true }>("DELETE", `/api/me/groups/${id}/members/${userId}`);
export const deleteGroup = (id: string) => json<{ ok: true }>("DELETE", `/api/me/groups/${id}`);

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

/** `seconds` = czas spędzony na rozdziale; serwer na tej podstawie ocenia, czy czytanie „się liczy". */
export async function markRead(bookId: string, chapter: number, seconds = 0) {
  const res = await apiRequest("POST", "/api/me/read", { bookId, chapter, seconds });
  return (await res.json()) as RewardDto & { counted: boolean };
}

export async function unmarkRead(bookId: string, chapter: number) {
  await apiRequest("DELETE", "/api/me/read", { bookId, chapter });
}

export async function setBookRead(bookId: string, read: boolean) {
  const res = await apiRequest("PUT", "/api/me/read/book", { bookId, read });
  return (await res.json()) as RewardDto;
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
  // Poziom, cel dzienny, seria i odznaki wynikają z tych samych danych.
  queryClient.invalidateQueries({ queryKey: qk.progress });
  queryClient.invalidateQueries({ queryKey: qk.badges });
  queryClient.invalidateQueries({ queryKey: qk.verseOfDay });
  queryClient.invalidateQueries({ queryKey: qk.leaderboard });
}

/** Nauka i grupy — osobno, bo zmieniają je inne akcje niż czytanie. */
export function invalidateLearn() {
  queryClient.invalidateQueries({ queryKey: qk.learn });
  queryClient.invalidateQueries({ queryKey: qk.verseOfDay });
  queryClient.invalidateQueries({ queryKey: qk.progress });
  queryClient.invalidateQueries({ queryKey: qk.badges });
  queryClient.invalidateQueries({ queryKey: ["/api/me/marks"] });
}

export function invalidateGroups() {
  queryClient.invalidateQueries({ queryKey: qk.groups });
  queryClient.invalidateQueries({ queryKey: qk.badges });
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
  queryClient.removeQueries({ queryKey: ["/api/admin/users"] });
  for (const k of [qk.progress, qk.badges, qk.learn, qk.verseOfDay, qk.groups, qk.leaderboard]) queryClient.removeQueries({ queryKey: k });
}
