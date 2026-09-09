import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

declare global {
  namespace Express {
    interface Request {
      /** Ustawiane wyłącznie przez `requireAuth` (server/auth.ts). */
      userId?: string;
    }
  }
}

/**
 * Jedyne miejsce, które wie „kim jest użytkownik".
 * Tożsamość ustala `requireAuth` z sesji Better Auth i wkłada ją w `req.userId`;
 * ta funkcja tylko ją odczytuje, dzięki czemu handlery tras nie dotykają sesji.
 *
 * Rzuca, jeśli trafi tu żądanie spoza `/api/me/*` — to znaczyłoby, że trasa
 * użytkownika została zamontowana z pominięciem bramki autoryzacji.
 */
export async function getUserId(req?: { userId?: string }): Promise<string> {
  const userId = req?.userId;
  if (!userId) {
    throw new Error("Trasa użytkownika bez requireAuth — brak req.userId");
  }
  return userId;
}
