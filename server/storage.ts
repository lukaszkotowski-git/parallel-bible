import { prisma } from "./db";
import { BOOK_BY_ID } from "@shared/books";
import { chaptersForDay, currentPlanDay, dayKey, daysBetween, planChapters } from "@shared/plans";
import type {
  BookDto,
  ChapterDto,
  ChapterMarksDto,
  FavoriteDto,
  FavoriteInput,
  HighlightColor,
  HighlightInput,
  NoteInput,
  NoteListItemDto,
  PlanDto,
  PlanInput,
  StatsDto,
  UserStateDto,
} from "@shared/schema";

const EN = "WEB";
const PL = "BG";

export interface IStorage {
  getBooks(): Promise<BookDto[]>;
  getChapter(bookId: string, chapter: number): Promise<ChapterDto | null>;
  getState(userId: string): Promise<UserStateDto>;
  setTheme(userId: string, theme: "light" | "dark"): Promise<void>;
  getReadChapters(userId: string, bookId?: string): Promise<{ bookId: string; chapter: number }[]>;
  markRead(userId: string, bookId: string, chapter: number): Promise<void>;
  unmarkRead(userId: string, bookId: string, chapter: number): Promise<void>;
  setPosition(userId: string, bookId: string, chapter: number): Promise<void>;
  setBookRead(userId: string, bookId: string, read: boolean): Promise<boolean>;
  getFavorites(userId: string, bookId?: string, chapter?: number): Promise<FavoriteDto[]>;
  addFavorite(userId: string, input: FavoriteInput): Promise<FavoriteDto>;
  removeFavorite(userId: string, bookId: string, chapter: number, verseFrom: number): Promise<void>;
  getMarks(userId: string, bookId: string, chapter: number): Promise<ChapterMarksDto>;
  setHighlight(userId: string, input: HighlightInput): Promise<void>;
  setNote(userId: string, input: NoteInput): Promise<void>;
  listNotes(userId: string): Promise<NoteListItemDto[]>;
  getPlans(userId: string, tz: string): Promise<PlanDto[]>;
  createPlan(userId: string, input: PlanInput): Promise<void>;
  deletePlan(userId: string, planId: string): Promise<void>;
  getStats(userId: string, tz: string): Promise<StatsDto>;
}

/** Ile dni wstecz zwraca mapa aktywności (26 tygodni = półroczny „kalendarz"). */
const DAILY_WINDOW_DAYS = 182;

export class DatabaseStorage implements IStorage {
  async getBooks(): Promise<BookDto[]> {
    const books = await prisma.book.findMany({ orderBy: { sortOrder: "asc" } });
    return books.map((b) => ({
      id: b.id,
      namePl: b.namePl,
      shortPl: BOOK_BY_ID[b.id]?.shortPl ?? b.namePl,
      nameEn: b.nameEn,
      testament: b.testament as "OT" | "NT",
      sortOrder: b.sortOrder,
      chapterCount: b.chapterCount,
    }));
  }

  async getChapter(bookId: string, chapter: number): Promise<ChapterDto | null> {
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book || chapter < 1 || chapter > book.chapterCount) return null;

    const [verses, translations, books, summary] = await Promise.all([
      prisma.verse.findMany({
        where: { bookId, chapter, translationId: { in: [EN, PL] } },
        orderBy: [{ verse: "asc" }],
        select: { translationId: true, verse: true, text: true },
      }),
      prisma.translation.findMany({ where: { id: { in: [EN, PL] } } }),
      prisma.book.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true, chapterCount: true } }),
      prisma.chapterSummary.findUnique({ where: { bookId_chapter: { bookId, chapter } } }),
    ]);

    const en = new Map<number, string>();
    const pl = new Map<number, string>();
    for (const v of verses) (v.translationId === EN ? en : pl).set(v.verse, v.text);

    // Parowanie best-effort po numerze wersetu — numeracja WEB i BG nie zawsze się pokrywa.
    const parallel = [...en.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([v, text]) => ({ v, en: text, pl: pl.get(v) ?? null }));
    const extraPl = [...pl.entries()]
      .filter(([v]) => !en.has(v))
      .sort((a, b) => a[0] - b[0])
      .map(([v, text]) => ({ v, pl: text }));

    const idx = books.findIndex((b) => b.id === bookId);
    const prev =
      chapter > 1
        ? { book: bookId, chapter: chapter - 1 }
        : idx > 0
          ? { book: books[idx - 1].id, chapter: books[idx - 1].chapterCount }
          : null;
    const next =
      chapter < book.chapterCount
        ? { book: bookId, chapter: chapter + 1 }
        : idx < books.length - 1
          ? { book: books[idx + 1].id, chapter: 1 }
          : null;

    const toDto = (id: string) => {
      const t = translations.find((x) => x.id === id)!;
      return {
        id: t.id,
        name: t.name,
        shortName: t.shortName,
        year: t.year,
        license: t.license,
        sourceUrl: t.sourceUrl,
      };
    };

    return {
      book: {
        id: book.id,
        namePl: book.namePl,
        nameEn: book.nameEn,
        chapter,
        totalChapters: book.chapterCount,
      },
      verses: parallel,
      extraPl,
      commentary: summary ? { en: summary.textEn, pl: summary.textPl } : null,
      nav: { prev, next },
      translations: { en: toDto(EN), pl: toDto(PL) },
    };
  }

  async getState(userId: string): Promise<UserStateDto> {
    const [readCount, favoritesCount, position, totals, user] = await Promise.all([
      prisma.readChapter.count({ where: { userId } }),
      prisma.favorite.count({ where: { userId } }),
      prisma.readingPosition.findUnique({ where: { userId } }),
      // Mianownik liczony z bazy, nie hardcodowany — po dodaniu deuterokanonu przeliczy się sam.
      prisma.book.aggregate({ _sum: { chapterCount: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { theme: true } }),
    ]);

    const totalChapters = totals._sum.chapterCount ?? 0;
    let positionDto: UserStateDto["position"] = null;
    if (position) {
      const book = await prisma.book.findUnique({ where: { id: position.bookId } });
      if (book) {
        positionDto = { bookId: book.id, namePl: book.namePl, chapter: position.chapter };
      }
    }

    return {
      position: positionDto,
      readCount,
      totalChapters,
      percent: totalChapters ? Math.round((readCount / totalChapters) * 1000) / 10 : 0,
      favoritesCount,
      theme: user?.theme === "dark" ? "dark" : "light",
    };
  }

  async setTheme(userId: string, theme: "light" | "dark") {
    await prisma.user.update({ where: { id: userId }, data: { theme } });
  }

  async getReadChapters(userId: string, bookId?: string) {
    return prisma.readChapter.findMany({
      where: { userId, ...(bookId ? { bookId } : {}) },
      select: { bookId: true, chapter: true },
      orderBy: { chapter: "asc" },
    });
  }

  async markRead(userId: string, bookId: string, chapter: number) {
    await prisma.readChapter.upsert({
      where: { userId_bookId_chapter: { userId, bookId, chapter } },
      update: {},
      create: { userId, bookId, chapter },
    });
  }

  async unmarkRead(userId: string, bookId: string, chapter: number) {
    await prisma.readChapter.deleteMany({ where: { userId, bookId, chapter } });
  }

  /** Zwraca false, gdy księga nie istnieje. Zaznaczenie nie rusza readAt już przeczytanych rozdziałów. */
  async setBookRead(userId: string, bookId: string, read: boolean) {
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) return false;
    if (read) {
      await prisma.readChapter.createMany({
        data: Array.from({ length: book.chapterCount }, (_, i) => ({ userId, bookId, chapter: i + 1 })),
        skipDuplicates: true,
      });
    } else {
      await prisma.readChapter.deleteMany({ where: { userId, bookId } });
    }
    return true;
  }

  async setPosition(userId: string, bookId: string, chapter: number) {
    await prisma.readingPosition.upsert({
      where: { userId },
      update: { bookId, chapter },
      create: { userId, bookId, chapter },
    });
  }

  async getFavorites(userId: string, bookId?: string, chapter?: number): Promise<FavoriteDto[]> {
    const rows = await prisma.favorite.findMany({
      where: { userId, ...(bookId ? { bookId } : {}), ...(chapter ? { chapter } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((f) => ({
      id: f.id,
      bookId: f.bookId,
      chapter: f.chapter,
      verseFrom: f.verseFrom,
      verseTo: f.verseTo,
      note: f.note,
      createdAt: f.createdAt.toISOString(),
    }));
  }

  async addFavorite(userId: string, input: FavoriteInput): Promise<FavoriteDto> {
    const f = await prisma.favorite.upsert({
      where: {
        userId_bookId_chapter_verseFrom: {
          userId,
          bookId: input.bookId,
          chapter: input.chapter,
          verseFrom: input.verseFrom,
        },
      },
      update: { verseTo: input.verseTo ?? null, note: input.note ?? null },
      create: {
        userId,
        bookId: input.bookId,
        chapter: input.chapter,
        verseFrom: input.verseFrom,
        verseTo: input.verseTo ?? null,
        note: input.note ?? null,
      },
    });
    return {
      id: f.id,
      bookId: f.bookId,
      chapter: f.chapter,
      verseFrom: f.verseFrom,
      verseTo: f.verseTo,
      note: f.note,
      createdAt: f.createdAt.toISOString(),
    };
  }

  async removeFavorite(userId: string, bookId: string, chapter: number, verseFrom: number) {
    await prisma.favorite.deleteMany({ where: { userId, bookId, chapter, verseFrom } });
  }

  async getMarks(userId: string, bookId: string, chapter: number): Promise<ChapterMarksDto> {
    const [highlights, notes] = await Promise.all([
      prisma.highlight.findMany({ where: { userId, bookId, chapter }, orderBy: { verse: "asc" } }),
      prisma.verseNote.findMany({ where: { userId, bookId, chapter }, orderBy: { verse: "asc" } }),
    ]);
    return {
      highlights: highlights.map((h) => ({ verse: h.verse, color: h.color as HighlightColor })),
      notes: notes.map((n) => ({ verse: n.verse, text: n.text, updatedAt: n.updatedAt.toISOString() })),
    };
  }

  async setHighlight(userId: string, { bookId, chapter, verse, color }: HighlightInput) {
    if (color === null) {
      await prisma.highlight.deleteMany({ where: { userId, bookId, chapter, verse } });
      return;
    }
    await prisma.highlight.upsert({
      where: { userId_bookId_chapter_verse: { userId, bookId, chapter, verse } },
      update: { color },
      create: { userId, bookId, chapter, verse, color },
    });
  }

  async setNote(userId: string, { bookId, chapter, verse, text }: NoteInput) {
    const trimmed = text.trim();
    if (!trimmed) {
      await prisma.verseNote.deleteMany({ where: { userId, bookId, chapter, verse } });
      return;
    }
    await prisma.verseNote.upsert({
      where: { userId_bookId_chapter_verse: { userId, bookId, chapter, verse } },
      update: { text: trimmed },
      create: { userId, bookId, chapter, verse, text: trimmed },
    });
  }

  async listNotes(userId: string): Promise<NoteListItemDto[]> {
    const rows = await prisma.verseNote.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
    return rows.map((n) => ({
      bookId: n.bookId,
      chapter: n.chapter,
      verse: n.verse,
      text: n.text,
      updatedAt: n.updatedAt.toISOString(),
    }));
  }

  async getPlans(userId: string, tz: string): Promise<PlanDto[]> {
    const [plans, read] = await Promise.all([
      prisma.readingPlan.findMany({ where: { userId }, orderBy: { startedAt: "desc" } }),
      prisma.readChapter.findMany({ where: { userId }, select: { bookId: true, chapter: true } }),
    ]);
    const readSet = new Set(read.map((r) => `${r.bookId}:${r.chapter}`));
    const isRead = (c: { bookId: string; chapter: number }) => readSet.has(`${c.bookId}:${c.chapter}`);
    const todayKey = dayKey(new Date(), tz);

    return plans.map((p) => {
      const chapters = planChapters(p.books);
      const n = chapters.length;
      const currentDay = currentPlanDay(dayKey(p.startedAt, tz), todayKey);
      const overdueUntil = Math.floor((Math.min(currentDay - 1, p.days) * n) / p.days);
      const finished = currentDay > p.days;
      const todayChapters = finished ? [] : chaptersForDay(chapters, p.days, currentDay);
      return {
        id: p.id,
        name: p.name,
        books: p.books,
        days: p.days,
        startedAt: p.startedAt.toISOString(),
        totalChapters: n,
        readChapters: chapters.filter(isRead).length,
        currentDay,
        overdue: chapters.slice(0, overdueUntil).filter((c) => !isRead(c)),
        today: finished
          ? null
          : { day: currentDay, chapters: todayChapters.map((c) => ({ ...c, read: isRead(c) })) },
        finished,
      };
    });
  }

  async createPlan(userId: string, input: PlanInput) {
    const total = planChapters(input.books).length;
    if (input.days > total) throw Object.assign(new Error("Plan ma więcej dni niż rozdziałów"), { status: 400 });
    await prisma.readingPlan.create({ data: { userId, name: input.name, books: input.books, days: input.days } });
  }

  async deletePlan(userId: string, planId: string) {
    await prisma.readingPlan.deleteMany({ where: { userId, id: planId } });
  }

  async getStats(userId: string, tz: string): Promise<StatsDto> {
    const [read, readByBook] = await Promise.all([
      prisma.readChapter.findMany({ where: { userId }, select: { readAt: true } }),
      prisma.readChapter.findMany({
        where: { userId },
        select: { bookId: true, chapter: true },
        orderBy: { chapter: "asc" },
      }),
    ]);

    const perDay = new Map<string, number>();
    for (const r of read) {
      const k = dayKey(r.readAt, tz);
      perDay.set(k, (perDay.get(k) ?? 0) + 1);
    }

    const todayKey = dayKey(new Date(), tz);
    const days = [...perDay.keys()].sort();

    let longest = 0;
    let run = 0;
    for (let i = 0; i < days.length; i++) {
      run = i > 0 && daysBetween(days[i - 1]!, days[i]!) === 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
    }

    // Seria żyje, jeśli ostatni dzień czytania to dziś albo wczoraj (dziś jeszcze można zdążyć).
    let current = 0;
    const last = days[days.length - 1];
    if (last && daysBetween(last, todayKey) <= 1) {
      current = 1;
      for (let i = days.length - 1; i > 0 && daysBetween(days[i - 1]!, days[i]!) === 1; i--) current++;
    }

    const daily: Record<string, number> = {};
    for (const [k, n] of perDay) if (daysBetween(k, todayKey) < DAILY_WINDOW_DAYS) daily[k] = n;

    const byBook: Record<string, number[]> = {};
    for (const r of readByBook) {
      const list = byBook[r.bookId] ?? [];
      list.push(r.chapter);
      byBook[r.bookId] = list;
    }

    return {
      currentStreak: current,
      longestStreak: longest,
      readToday: perDay.has(todayKey),
      totalRead: read.length,
      daily,
      byBook,
    };
  }
}

export const storage = new DatabaseStorage();
