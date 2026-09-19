import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import { getUserId } from "./db";
import { googleEnabled, requireAuth } from "./auth";
import { mailEnabled } from "./mail";
import {
  bookReadSchema,
  chapterRefSchema,
  favoriteInputSchema,
  highlightInputSchema,
  noteInputSchema,
  planInputSchema,
  themeSchema,
} from "@shared/schema";
import { safeTimeZone } from "@shared/plans";

// Tekst biblijny jest niezmienny → agresywny cache po stronie klienta/CDN.
// Express dokłada słaby ETag do res.json(), więc po wygaśnięciu max-age przeglądarka
// rewaliduje przez If-None-Match i dostaje 304 bez ciała.
const IMMUTABLE = "public, max-age=86400, stale-while-revalidate=604800";

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: (e?: unknown) => void) => {
    fn(req, res).catch(next);
  };
}

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
  app.get("/api/config", (_req, res) => res.json({ google: googleEnabled, mail: mailEnabled }));

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
      const parsed = chapterRefSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      await storage.markRead(await getUserId(req), parsed.data.bookId, parsed.data.chapter);
      res.json({ ok: true });
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
      const ok = await storage.setBookRead(await getUserId(req), parsed.data.bookId, parsed.data.read);
      if (!ok) return res.status(404).json({ message: "Nie znaleziono księgi" });
      res.json({ ok: true });
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
      await storage.setHighlight(await getUserId(req), parsed.data);
      res.json({ ok: true });
    }),
  );

  app.put(
    "/api/me/notes",
    asyncHandler(async (req, res) => {
      const parsed = noteInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      await storage.setNote(await getUserId(req), parsed.data);
      res.json({ ok: true });
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
      await storage.createPlan(await getUserId(req), parsed.data);
      res.json({ ok: true });
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

  app.put(
    "/api/me/theme",
    asyncHandler(async (req, res) => {
      const parsed = themeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nieprawidłowe dane" });
      await storage.setTheme(await getUserId(req), parsed.data.theme);
      res.json({ ok: true });
    }),
  );

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  return httpServer;
}
