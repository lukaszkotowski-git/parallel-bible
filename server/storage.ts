import { prisma } from "./db";
import { BOOK_BY_ID } from "@shared/books";
import { chaptersForDay, currentPlanDay, dayKey, daysBetween, planChapters } from "@shared/plans";
import { getProgress } from "./gamification";
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
import type { AdminUserDto, AdminUserPatch, AdminUsersDto } from "@shared/schema";

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
  adminListUsers(q: string, page: number, pageSize: number): Promise<AdminUsersDto>;
  adminUpdateUser(actorId: string, targetId: string, patch: AdminUserPatch): Promise<void>;
  adminRevokeSessions(targetId: string): Promise<void>;
  adminDeleteUser(actorId: string, targetId: string): Promise<void>;
}

const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

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
      prisma.user.findUnique({ where: { id: userId }, select: { theme: true, role: true } }),
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
      role: user?.role === "admin" ? "admin" : "user",
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
        // counted:false — zbiorcze odhaczenie „już to czytałem" liczy się do postępu, ale nie do serii/XP.
        data: Array.from({ length: book.chapterCount }, (_, i) => ({ userId, bookId, chapter: i + 1, counted: false })),
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
    const [highlights, notes, checks, cards] = await Promise.all([
      prisma.highlight.findMany({ where: { userId, bookId, chapter }, orderBy: { verse: "asc" } }),
      prisma.verseNote.findMany({ where: { userId, bookId, chapter }, orderBy: { verse: "asc" } }),
      prisma.verseCheck.findMany({ where: { userId, bookId, chapter }, select: { verse: true, understood: true } }),
      prisma.learnCard.findMany({ where: { userId, bookId, chapter }, select: { verse: true } }),
    ]);
    return {
      highlights: highlights.map((h) => ({ verse: h.verse, color: h.color as HighlightColor })),
      notes: notes.map((n) => ({ verse: n.verse, text: n.text, updatedAt: n.updatedAt.toISOString() })),
      checks,
      cards: cards.map((c) => c.verse),
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
    const [read, progress] = await Promise.all([
      prisma.readChapter.findMany({ where: { userId }, select: { bookId: true, chapter: true, readAt: true, counted: true } }),
      // Seria (z „dniem oddechu" i przywróceniem) ma jedno źródło prawdy: gamifikacja.
      getProgress(userId, tz),
    ]);

    // Kalendarz aktywności pokazuje tylko czytanie, które się liczy (nie odhaczanie zbiorcze).
    const perDay = new Map<string, number>();
    for (const r of read) {
      if (!r.counted) continue;
      const k = dayKey(r.readAt, tz);
      perDay.set(k, (perDay.get(k) ?? 0) + 1);
    }
    const todayKey = dayKey(new Date(), tz);
    const daily: Record<string, number> = {};
    for (const [k, n] of perDay) if (daysBetween(k, todayKey) < DAILY_WINDOW_DAYS) daily[k] = n;

    const byBook: Record<string, number[]> = {};
    for (const r of [...read].sort((a, b) => a.chapter - b.chapter)) {
      const list = byBook[r.bookId] ?? [];
      list.push(r.chapter);
      byBook[r.bookId] = list;
    }

    return {
      currentStreak: progress.streak.current,
      longestStreak: progress.streak.longest,
      readToday: progress.streak.readToday,
      totalRead: read.length,
      daily,
      byBook,
    };
  }

  async adminListUsers(q: string, page: number, pageSize: number): Promise<AdminUsersDto> {
    const term = q.trim();
    const where = term
      ? {
          OR: [
            { email: { contains: term, mode: "insensitive" as const } },
            { name: { contains: term, mode: "insensitive" as const } },
          ],
        }
      : {};
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);

    const [rows, total, verified, admins, newLast7d, activeSessions] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          role: true,
          createdAt: true,
          accounts: { select: { providerId: true } },
          // Tylko liczniki — nie wczytujemy treści notatek ani ulubionych.
          _count: {
            select: { readChapters: true, favorites: true, verseNotes: true, highlights: true, plans: true },
          },
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.user.count({ where: { role: "admin" } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.session.groupBy({ by: ["userId"], where: { updatedAt: { gte: weekAgo } } }),
    ]);

    const ids = rows.map((r) => r.id);
    const [lastSession, lastRead, totalUsers] = await Promise.all([
      prisma.session.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _max: { updatedAt: true } }),
      prisma.readChapter.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _max: { readAt: true } }),
      prisma.user.count(),
    ]);
    const sessionAt = new Map(lastSession.map((s) => [s.userId, s._max.updatedAt]));
    const readAt = new Map(lastRead.map((s) => [s.userId, s._max.readAt]));

    const users: AdminUserDto[] = rows.map((u) => {
      const times = [sessionAt.get(u.id), readAt.get(u.id)].filter((d): d is Date => !!d);
      const last = times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified,
        role: u.role === "admin" ? "admin" : "user",
        createdAt: u.createdAt.toISOString(),
        lastActiveAt: last?.toISOString() ?? null,
        providers: [...new Set(u.accounts.map((a) => a.providerId))],
        counts: {
          read: u._count.readChapters,
          favorites: u._count.favorites,
          notes: u._count.verseNotes,
          highlights: u._count.highlights,
          plans: u._count.plans,
        },
      };
    });

    return {
      users,
      total,
      page,
      pageSize,
      summary: { total: totalUsers, verified, admins, newLast7d, activeLast7d: activeSessions.length },
    };
  }

  async adminUpdateUser(actorId: string, targetId: string, patch: AdminUserPatch) {
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } });
    if (!target) throw httpError(404, "Nie znaleziono użytkownika");
    if (patch.role === "user" && target.role === "admin") {
      if (targetId === actorId) throw httpError(400, "Nie możesz odebrać sobie roli administratora");
      // Zawsze musi zostać ktoś z dostępem do panelu.
      if ((await prisma.user.count({ where: { role: "admin" } })) <= 1) {
        throw httpError(400, "To ostatni administrator");
      }
    }
    await prisma.user.update({
      where: { id: targetId },
      data: {
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.emailVerified !== undefined ? { emailVerified: patch.emailVerified } : {}),
      },
    });
  }

  async adminRevokeSessions(targetId: string) {
    await prisma.session.deleteMany({ where: { userId: targetId } });
  }

  async adminDeleteUser(actorId: string, targetId: string) {
    if (targetId === actorId) throw httpError(400, "Nie możesz usunąć własnego konta z panelu");
    const { count } = await prisma.user.deleteMany({ where: { id: targetId } });
    if (count === 0) throw httpError(404, "Nie znaleziono użytkownika");
  }
}

export const storage = new DatabaseStorage();
