import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@parallel-bible.local";

/**
 * Jedyne miejsce, które wie „kim jest użytkownik".
 * MVP: seedowany użytkownik `demo`.
 * Faza 2 (Better Auth): podmiana ciała funkcji na `session.user.id` — handlery bez zmian.
 */
export async function getUserId(_req?: unknown): Promise<string> {
  const email = DEMO_USER_EMAIL;
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Demo" },
    select: { id: true },
  });
  return user.id;
}
