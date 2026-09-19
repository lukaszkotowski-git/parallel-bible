/**
 * Grupy czytelnicze. Prywatność jest założeniem projektu: grupa widzi o członku tylko
 * imię, „czy dziś czytał(a)" i (przy wspólnym planie) „czy na bieżąco" — nigdy liczb,
 * notatek ani ulubionych. Dzięki temu wspólnota motywuje, a nie porównuje.
 */
import { randomInt } from "node:crypto";
import { prisma } from "./db";
import { BOOK_BY_ID } from "@shared/books";
import { dayKey, planStatus } from "@shared/plans";
import { addDays } from "@shared/gamification";
import type { GroupDetailDto, GroupMemberDto, GroupSummaryDto } from "@shared/gamification";

const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // bez mylących 0/O, 1/I/L
const newCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

const RUN_WINDOW_DAYS = 120;

/** Dni „prawdziwego" czytania (counted) dla każdego z użytkowników z ostatnich `days` dni. */
async function readDaysFor(userIds: string[], tz: string, days: number) {
  const since = new Date(Date.now() - (days + 1) * 86_400_000);
  const rows = await prisma.readChapter.findMany({
    where: { userId: { in: userIds }, counted: true, readAt: { gte: since } },
    select: { userId: true, readAt: true },
  });
  const byUser = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = byUser.get(r.userId) ?? new Set<string>();
    set.add(dayKey(r.readAt, tz));
    byUser.set(r.userId, set);
  }
  return byUser;
}

/** Wspólna seria: dni z rzędu, w których czytała co najmniej połowa grupy (min. 2 osoby). */
function sharedRun(memberDays: Map<string, Set<string>>, memberCount: number, todayKey: string) {
  if (memberCount < 2) return { current: 0, best: 0 };
  const threshold = Math.ceil(memberCount / 2);
  const perDay = new Map<string, number>();
  for (const set of memberDays.values()) for (const d of set) perDay.set(d, (perDay.get(d) ?? 0) + 1);

  let run = 0;
  let best = 0;
  for (let d = addDays(todayKey, -RUN_WINDOW_DAYS); d <= todayKey; d = addDays(d, 1)) {
    if ((perDay.get(d) ?? 0) >= threshold) {
      run++;
      best = Math.max(best, run);
    } else if (d !== todayKey) {
      run = 0; // dziś jeszcze można przeczytać — brak czytania dziś niczego nie przerywa
    }
  }
  return { current: run, best };
}

async function requireMembership(userId: string, groupId: string) {
  const group = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId } } },
    include: { members: { include: { user: { select: { id: true, name: true } } }, orderBy: { joinedAt: "asc" } } },
  });
  if (!group) throw httpError(404, "Nie znaleziono grupy");
  return group;
}

export async function listGroups(userId: string, tz: string): Promise<GroupSummaryDto[]> {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    include: { members: { select: { userId: true } } },
    orderBy: { createdAt: "asc" },
  });
  const allIds = [...new Set(groups.flatMap((g) => g.members.map((m) => m.userId)))];
  const today = dayKey(new Date(), tz);
  const days = allIds.length ? await readDaysFor(allIds, tz, 1) : new Map<string, Set<string>>();
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: g.members.length,
    readToday: g.members.filter((m) => days.get(m.userId)?.has(today)).length,
    isOwner: g.ownerId === userId,
    hasPlan: !!g.planDays,
  }));
}

export async function createGroup(userId: string, input: { name: string; description?: string }) {
  const group = await prisma.group.create({
    data: {
      name: input.name,
      description: input.description || null,
      inviteCode: newCode(),
      ownerId: userId,
      members: { create: { userId } },
    },
  });
  return group.id;
}

export async function joinGroup(userId: string, code: string) {
  const group = await prisma.group.findUnique({ where: { inviteCode: code.trim().toUpperCase() } });
  if (!group) throw httpError(404, "Nieprawidłowy kod zaproszenia");
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId } },
    update: {},
    create: { groupId: group.id, userId },
  });
  return group.id;
}

export async function getGroup(userId: string, groupId: string, tz: string): Promise<GroupDetailDto> {
  const group = await requireMembership(userId, groupId);
  const memberIds = group.members.map((m) => m.userId);
  const today = dayKey(new Date(), tz);
  const days = await readDaysFor(memberIds, tz, RUN_WINDOW_DAYS);

  // Wspólny plan: „na bieżąco" liczymy z całego ReadChapter członka (bez wymogu counted —
  // plan mierzy postęp w tekście, seria mierzy uczciwość czytania).
  let plan: GroupDetailDto["plan"] = null;
  const onTrack = new Map<string, boolean>();
  if (group.planDays && group.planStartedAt) {
    const cfg = { books: group.planBooks, days: group.planDays, startedAt: group.planStartedAt };
    const rows = await prisma.readChapter.findMany({
      where: { userId: { in: memberIds }, bookId: { in: group.planBooks } },
      select: { userId: true, bookId: true, chapter: true },
    });
    const readBy = new Map<string, Set<string>>();
    for (const r of rows) {
      const set = readBy.get(r.userId) ?? new Set<string>();
      set.add(`${r.bookId}:${r.chapter}`);
      readBy.set(r.userId, set);
    }
    const statusFor = (uid: string) =>
      planStatus(cfg, (c) => readBy.get(uid)?.has(`${c.bookId}:${c.chapter}`) ?? false, tz);
    for (const uid of memberIds) onTrack.set(uid, statusFor(uid).overdue.length === 0);
    const mine = statusFor(userId);
    plan = {
      name: group.planName ?? "Wspólny plan",
      books: group.planBooks,
      days: group.planDays,
      startedAt: group.planStartedAt.toISOString(),
      currentDay: mine.currentDay,
      finished: mine.finished,
      today: mine.today.map((c) => ({ ...c, read: readBy.get(userId)?.has(`${c.bookId}:${c.chapter}`) ?? false })),
      myOverdue: mine.overdue.length,
    };
  }

  const members: GroupMemberDto[] = group.members.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    isOwner: m.userId === group.ownerId,
    isMe: m.userId === userId,
    readToday: days.get(m.userId)?.has(today) ?? false,
    onTrack: plan ? (onTrack.get(m.userId) ?? null) : null,
  }));

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    inviteCode: group.inviteCode,
    isOwner: group.ownerId === userId,
    members,
    readToday: members.filter((m) => m.readToday).length,
    sharedRun: sharedRun(days, members.length, today),
    plan,
  };
}

async function requireOwner(userId: string, groupId: string) {
  const group = await requireMembership(userId, groupId);
  if (group.ownerId !== userId) throw httpError(403, "Tylko właściciel grupy może to zrobić");
  return group;
}

export async function updateGroup(
  userId: string,
  groupId: string,
  patch: {
    name?: string;
    description?: string | null;
    plan?: { name: string; books: string[]; days: number } | null;
  },
) {
  await requireOwner(userId, groupId);
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.description !== undefined) data.description = patch.description || null;
  if (patch.plan === null) {
    Object.assign(data, { planName: null, planBooks: [], planDays: null, planStartedAt: null });
  } else if (patch.plan) {
    const { name, books, days } = patch.plan;
    if (!books.every((b) => b in BOOK_BY_ID) || new Set(books).size !== books.length) {
      throw httpError(400, "Nieznana lub powtórzona księga");
    }
    const total = books.reduce((sum, b) => sum + BOOK_BY_ID[b]!.chapterCount, 0);
    if (days > total) throw httpError(400, "Plan ma więcej dni niż rozdziałów");
    Object.assign(data, { planName: name, planBooks: books, planDays: days, planStartedAt: new Date() });
  }
  await prisma.group.update({ where: { id: groupId }, data });
}

export async function regenerateCode(userId: string, groupId: string) {
  await requireOwner(userId, groupId);
  await prisma.group.update({ where: { id: groupId }, data: { inviteCode: newCode() } });
}

/** Członek odchodzi sam albo właściciel usuwa członka. Właściciel nie może odejść — usuwa grupę. */
export async function removeMember(actorId: string, groupId: string, targetId: string) {
  const group = await requireMembership(actorId, groupId);
  if (targetId === group.ownerId) throw httpError(400, "Właściciel nie może opuścić grupy — może ją usunąć");
  if (targetId !== actorId && group.ownerId !== actorId) throw httpError(403, "Brak uprawnień");
  await prisma.groupMember.deleteMany({ where: { groupId, userId: targetId } });
}

export async function deleteGroup(userId: string, groupId: string) {
  await requireOwner(userId, groupId);
  await prisma.group.delete({ where: { id: groupId } });
}

/** Najlepsza wspólna seria spośród grup użytkownika (do odznaki „Wspólny tydzień"). */
export async function bestGroupRun(userId: string, tz: string) {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    include: { members: { select: { userId: true } } },
  });
  const today = dayKey(new Date(), tz);
  let best = 0;
  for (const g of groups) {
    const days = await readDaysFor(g.members.map((m) => m.userId), tz, RUN_WINDOW_DAYS);
    best = Math.max(best, sharedRun(days, g.members.length, today).best);
  }
  return { best, memberships: groups.length };
}
