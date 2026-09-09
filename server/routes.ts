import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import { getUserId } from "./db";
import { chapterRefSchema, favoriteInputSchema, themeSchema } from "@shared/schema";

// Tekst biblijny jest niezmienny → agresywny cache po stronie klienta/CDN.
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

  // ---- stan użytkownika (faza 2: te same handlery za sesją Better Auth) ----

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
