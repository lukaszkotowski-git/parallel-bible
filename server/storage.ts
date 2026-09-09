import { prisma } from "./db";
import { BOOK_BY_ID } from "@shared/books";
import type {
  BookDto,
  ChapterDto,
  FavoriteDto,
  FavoriteInput,
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
  getFavorites(userId: string, bookId?: string, chapter?: number): Promise<FavoriteDto[]>;
  addFavorite(userId: string, input: FavoriteInput): Promise<FavoriteDto>;
  removeFavorite(userId: string, bookId: string, chapter: number, verseFrom: number): Promise<void>;
}

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

    const [verses, translations, books] = await Promise.all([
      prisma.verse.findMany({
        where: { bookId, chapter, translationId: { in: [EN, PL] } },
        orderBy: [{ verse: "asc" }],
        select: { translationId: true, verse: true, text: true },
      }),
      prisma.translation.findMany({ where: { id: { in: [EN, PL] } } }),
      prisma.book.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true, chapterCount: true } }),
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
}

export const storage = new DatabaseStorage();
