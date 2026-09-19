import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import { getUserId } from "./db";
import { googleEnabled, requireAdmin, requireAuth } from "./auth";
import { mailEnabled } from "./mail";
import { getBadges, getProgress, recordRead, restoreStreak, setGoal, syncBadges } from "./gamification";
import { getLeaderboard, setLeaderboardOptIn } from "./leaderboard";
import { addCard, checkVerse, getLearn, removeCard, reviewCard, setMastered, verseOfDay } from "./learn";
import {
  createGroup,
  deleteGroup,
  getGroup,
  joinGroup,
  listGroups,
  regenerateCode,
  removeMember,
  updateGroup,
} from "./groups";
import {
  bookReadSchema,
  adminUserPatchSchema,
  chapterRefSchema,
  favoriteInputSchema,
  highlightInputSchema,
  noteInputSchema,
  planInputSchema,
  themeSchema,
} from "@shared/schema";
import { safeTimeZone } from "@shared/plans";
import {
  checkInputSchema,
  goalInputSchema,
  leaderboardOptSchema,
  groupCreateSchema,
  groupJoinSchema,
  groupPatchSchema,
  masteredInputSchema,
  restoreInputSchema,
  reviewInputSchema,
  verseRefInputSchema,
} from "@shared/gamification";
import { z } from "zod";

// Tekst biblijny jest niezmienny → agresywny cache po stronie klienta/CDN.
// Express dokłada słaby ETag do res.json(), więc po wygaśnięciu max-age przeglądarka
// rewaliduje przez If-None-Match i dostaje 304 bez ciała.
const IMMUTABLE = "public, max-age=86400, stale-while-revalidate=604800";

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: (e?: unknown) => void) => {
    fn(req, res).catch(next);
  };
}

/**
 * „Postaw mi kawę": BUYMEACOFFEE_URL to pełny adres (https://buymeacoffee.com/nazwa) albo sama
 * nazwa użytkownika. Przyjmujemy wyłącznie https — wartość trafia do linku w interfejsie.
 * Bez zmiennej przycisku po prostu nie ma.
 */
function coffeeUrl(): string | null {
  const raw = (process.env.BUYMEACOFFEE_URL ?? "").trim();
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://buymeacoffee.com/${raw.replace(/^@/, "").replace(/\//g, "")}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Strefa użytkownika: z ?tz= albo nagłówka X-Timezone (klient dokłada go do każdego żądania). */
const tzOf = (req: Request) => safeTimeZone(req.query.tz ?? req.header("x-timezone"));

const readInputSchema = chapterRefSchema.extend({
  /** Czas spędzony na rozdziale (s), raportowany przez klienta — decyduje, czy czytanie „się liczy". */
  seconds: z.number().int().min(0).max(86_400).optional(),
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ---- treść (read-only, cache'owalna) ----

  app.get(
    "/api/books",
    asyncHandler(async (_req, res) => {
      res.set("Cache-Control", IMMUTABLE);
      res.json(await storage.getBooks());
    }),
  );

  app.get(
    "/api/chapter/:book/:chapter",
    asyncHandler(async (req, res) => {
      const chapter = Number(req.params.chapter);
      if (!Number.isInteger(chapter) || chapter < 1) {
        return res.status(400).json({ message: "Nieprawidłowy numer rozdziału" });
      }
      const data = await storage.getChapter(String(req.params.book), chapter);
      if (!data) return res.status(404).json({ message: "Nie znaleziono rozdziału" });
      res.set("Cache-Control", IMMUTABLE);
      res.json(data);
    }),
  );

  // Co klient ma pokazać na ekranie logowania (publiczne, bez sesji).
  app.get("/api/config", (_req, res) => res.json({ google: googleEnabled, mail: mailEnabled, coffeeUrl: coffeeUrl() }));

  // ---- stan użytkownika ----
  // Jedna bramka na cały prefiks: bez sesji te trasy zwracają 401, a handlery
  // poniżej mogą bezwarunkowo ufać `getUserId(req)`.
  app.use("/api/me", (_req, res, next) => {
    // Dane osobiste nie mogą trafić do współdzielonego cache (CDN/proxy).
    res.set("Cache-Control", "private, no-store");
    next();
  });
  app.use("/api/me", requireAuth);

  app.get(
    "/api/me/state",
    asyncHandler(async (req, res) => {
      res.json(await storage.getState(await getUserId(req)));
    }),
  );

  app.put(
    "/api/me/position",
    asyncHandler(async (req, res) => {
      const parsed = chapterRefSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      await storage.setPosition(await getUserId(req), parsed.data.bookId, parsed.data.chapter);
      res.json({ ok: true });
    }),
  );

  app.get(
    "/api/me/read",
    asyncHandler(async (req, res) => {
      const bookId = typeof req.query.book === "string" ? req.query.book : undefined;
      res.json(await storage.getReadChapters(await getUserId(req), bookId));
    }),
  );

  app.post(
    "/api/me/read",
    asyncHandler(async (req, res) => {
      const parsed = readInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      const userId = await getUserId(req);
      const counted = await recordRead(userId, parsed.data.bookId, parsed.data.chapter, parsed.data.seconds ?? 0);
      res.json({ ok: true, counted, ...(await syncBadges(userId, tzOf(req))) });
    }),
  );

  app.delete(
    "/api/me/read",
    asyncHandler(async (req, res) => {
      const parsed = chapterRefSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      await storage.unmarkRead(await getUserId(req), parsed.data.bookId, parsed.data.chapter);
      res.json({ ok: true });
    }),
  );

  app.put(
    "/api/me/read/book",
    asyncHandler(async (req, res) => {
      const parsed = bookReadSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      const userId = await getUserId(req);
      const ok = await storage.setBookRead(userId, parsed.data.bookId, parsed.data.read);
      if (!ok) return res.status(404).json({ message: "Nie znaleziono księgi" });
      res.json({ ok: true, ...(await syncBadges(userId, tzOf(req))) });
    }),
  );

  app.get(
    "/api/me/favorites",
    asyncHandler(async (req, res) => {
      const bookId = typeof req.query.book === "string" ? req.query.book : undefined;
      const chapter = req.query.chapter ? Number(req.query.chapter) : undefined;
      res.json(await storage.getFavorites(await getUserId(req), bookId, chapter));
    }),
  );

  app.post(
    "/api/me/favorites",
    asyncHandler(async (req, res) => {
      const parsed = favoriteInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      res.json(await storage.addFavorite(await getUserId(req), parsed.data));
    }),
  );

  app.delete(
    "/api/me/favorites",
    asyncHandler(async (req, res) => {
      const parsed = favoriteInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      const { bookId, chapter, verseFrom } = parsed.data;
      await storage.removeFavorite(await getUserId(req), bookId, chapter, verseFrom);
      res.json({ ok: true });
    }),
  );

  // Wyróżnienia i notatki: jeden odczyt na rozdział, zapis pojedynczego wersetu.
  app.get(
    "/api/me/marks",
    asyncHandler(async (req, res) => {
      const parsed = chapterRefSchema.safeParse({
        bookId: req.query.book,
        chapter: Number(req.query.chapter),
      });
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      res.json(await storage.getMarks(await getUserId(req), parsed.data.bookId, parsed.data.chapter));
    }),
  );

  app.put(
    "/api/me/highlights",
    asyncHandler(async (req, res) => {
      const parsed = highlightInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      const userId = await getUserId(req);
      await storage.setHighlight(userId, parsed.data);
      res.json({ ok: true, ...(await syncBadges(userId, tzOf(req))) });
    }),
  );

  app.put(
    "/api/me/notes",
    asyncHandler(async (req, res) => {
      const parsed = noteInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      const userId = await getUserId(req);
      await storage.setNote(userId, parsed.data);
      res.json({ ok: true, ...(await syncBadges(userId, tzOf(req))) });
    }),
  );

  app.get(
    "/api/me/notes",
    asyncHandler(async (req, res) => {
      res.json(await storage.listNotes(await getUserId(req)));
    }),
  );

  // Plany i statystyki zależą od „dziś" użytkownika, więc klient podaje strefę (?tz=Europe/Warsaw).
  app.get(
    "/api/me/plans",
    asyncHandler(async (req, res) => {
      res.json(await storage.getPlans(await getUserId(req), safeTimeZone(req.query.tz)));
    }),
  );

  app.post(
    "/api/me/plans",
    asyncHandler(async (req, res) => {
      const parsed = planInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      const userId = await getUserId(req);
      await storage.createPlan(userId, parsed.data);
      res.json({ ok: true, ...(await syncBadges(userId, tzOf(req))) });
    }),
  );

  app.delete(
    "/api/me/plans/:id",
    asyncHandler(async (req, res) => {
      await storage.deletePlan(await getUserId(req), String(req.params.id));
      res.json({ ok: true });
    }),
  );

  app.get(
    "/api/me/stats",
    asyncHandler(async (req, res) => {
      res.json(await storage.getStats(await getUserId(req), safeTimeZone(req.query.tz)));
    }),
  );

  // ---- gamifikacja: postęp, cel, odznaki, seria ----

  app.get(
    "/api/me/progress",
    asyncHandler(async (req, res) => {
      res.json(await getProgress(await getUserId(req), tzOf(req)));
    }),
  );

  app.get(
    "/api/me/badges",
    asyncHandler(async (req, res) => {
      res.json(await getBadges(await getUserId(req), tzOf(req)));
    }),
  );

  app.put(
    "/api/me/goal",
    asyncHandler(async (req, res) => {
      const parsed = goalInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      await setGoal(await getUserId(req), parsed.data.dailyChapters);
      res.json({ ok: true });
    }),
  );

  app.post(
    "/api/me/streak/restore",
    asyncHandler(async (req, res) => {
      const parsed = restoreInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      await restoreStreak(await getUserId(req), tzOf(req), parsed.data.day);
      res.json({ ok: true });
    }),
  );

  // ---- ranking (uczestnictwo dobrowolne — patrz server/leaderboard.ts) ----

  app.get(
    "/api/me/leaderboard",
    asyncHandler(async (req, res) => {
      res.json(await getLeaderboard(await getUserId(req), tzOf(req)));
    }),
  );

  app.put(
    "/api/me/leaderboard/opt",
    asyncHandler(async (req, res) => {
      const parsed = leaderboardOptSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      await setLeaderboardOptIn(await getUserId(req), parsed.data.show);
      res.json({ ok: true });
    }),
  );

  // ---- nauka: fiszki, werset dnia, odpowiedzi po odsłonięciu PL ----

  app.get(
    "/api/me/learn",
    asyncHandler(async (req, res) => {
      res.json(await getLearn(await getUserId(req)));
    }),
  );

  app.get(
    "/api/me/verse-of-day",
    asyncHandler(async (req, res) => {
      res.json(await verseOfDay(await getUserId(req), tzOf(req)));
    }),
  );

  app.post(
    "/api/me/learn/cards",
    asyncHandler(async (req, res) => {
      const parsed = verseRefInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      const userId = await getUserId(req);
      await addCard(userId, parsed.data);
      res.json({ ok: true, ...(await syncBadges(userId, tzOf(req))) });
    }),
  );

  app.delete(
    "/api/me/learn/cards",
    asyncHandler(async (req, res) => {
      const parsed = verseRefInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      await removeCard(await getUserId(req), parsed.data);
      res.json({ ok: true });
    }),
  );

  app.post(
    "/api/me/learn/review",
    asyncHandler(async (req, res) => {
      const parsed = reviewInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      const { rating, ...ref } = parsed.data;
      const userId = await getUserId(req);
      await reviewCard(userId, ref, rating);
      res.json({ ok: true, ...(await syncBadges(userId, tzOf(req))) });
    }),
  );

  app.put(
    "/api/me/learn/mastered",
    asyncHandler(async (req, res) => {
      const parsed = masteredInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      const { mastered, ...ref } = parsed.data;
      const userId = await getUserId(req);
      await setMastered(userId, ref, mastered);
      res.json({ ok: true, ...(await syncBadges(userId, tzOf(req))) });
    }),
  );

  app.put(
    "/api/me/learn/check",
    asyncHandler(async (req, res) => {
      const parsed = checkInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      const { understood, ...ref } = parsed.data;
      const userId = await getUserId(req);
      const { addedToDeck } = await checkVerse(userId, ref, understood);
      res.json({ ok: true, addedToDeck, ...(await syncBadges(userId, tzOf(req))) });
    }),
  );

  // ---- grupy czytelnicze (członek widzi tylko „czy dziś czytał" i „czy na bieżąco") ----

  app.get(
    "/api/me/groups",
    asyncHandler(async (req, res) => {
      res.json(await listGroups(await getUserId(req), tzOf(req)));
    }),
  );

  app.post(
    "/api/me/groups",
    asyncHandler(async (req, res) => {
      const parsed = groupCreateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      const userId = await getUserId(req);
      const id = await createGroup(userId, parsed.data);
      res.json({ ok: true, id, ...(await syncBadges(userId, tzOf(req))) });
    }),
  );

  app.post(
    "/api/me/groups/join",
    asyncHandler(async (req, res) => {
      const parsed = groupJoinSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      const userId = await getUserId(req);
      const id = await joinGroup(userId, parsed.data.code);
      res.json({ ok: true, id, ...(await syncBadges(userId, tzOf(req))) });
    }),
  );

  app.get(
    "/api/me/groups/:id",
    asyncHandler(async (req, res) => {
      res.json(await getGroup(await getUserId(req), String(req.params.id), tzOf(req)));
    }),
  );

  app.patch(
    "/api/me/groups/:id",
    asyncHandler(async (req, res) => {
      const parsed = groupPatchSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      await updateGroup(await getUserId(req), String(req.params.id), parsed.data);
      res.json({ ok: true });
    }),
  );

  app.post(
    "/api/me/groups/:id/regenerate-code",
    asyncHandler(async (req, res) => {
      await regenerateCode(await getUserId(req), String(req.params.id));
      res.json({ ok: true });
    }),
  );

  app.delete(
    "/api/me/groups/:id/members/:userId",
    asyncHandler(async (req, res) => {
      const actor = await getUserId(req);
      const target = req.params.userId === "me" ? actor : String(req.params.userId);
      await removeMember(actor, String(req.params.id), target);
      res.json({ ok: true });
    }),
  );

  app.delete(
    "/api/me/groups/:id",
    asyncHandler(async (req, res) => {
      await deleteGroup(await getUserId(req), String(req.params.id));
      res.json({ ok: true });
    }),
  );

  app.put(
    "/api/me/theme",
    asyncHandler(async (req, res) => {
      const parsed = themeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      await storage.setTheme(await getUserId(req), parsed.data.theme);
      res.json({ ok: true });
    }),
  );

  // ---- panel administratora ----
  // Osobny prefiks za własną bramką: rola jest sprawdzana w bazie przy każdym żądaniu.
  // Admin widzi konta i liczniki aktywności, ale nie treść notatek ani ulubionych.
  app.use("/api/admin", (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  });
  app.use("/api/admin", requireAdmin);

  app.get(
    "/api/admin/users",
    asyncHandler(async (req, res) => {
      const q = typeof req.query.q === "string" ? req.query.q.slice(0, 100) : "";
      const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
      res.json(await storage.adminListUsers(q, page, 25));
    }),
  );

  app.patch(
    "/api/admin/users/:id",
    asyncHandler(async (req, res) => {
      const parsed = adminUserPatchSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      await storage.adminUpdateUser(await getUserId(req), String(req.params.id), parsed.data);
      res.json({ ok: true });
    }),
  );

  app.post(
    "/api/admin/users/:id/revoke-sessions",
    asyncHandler(async (req, res) => {
      await storage.adminRevokeSessions(String(req.params.id));
      res.json({ ok: true });
    }),
  );

  app.delete(
    "/api/admin/users/:id",
    asyncHandler(async (req, res) => {
      await storage.adminDeleteUser(await getUserId(req), String(req.params.id));
      res.json({ ok: true });
    }),
  );

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  return httpServer;
}
