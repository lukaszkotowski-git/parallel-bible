/**
 * Konfiguracja Better Auth.
 *
 * Zasada podziału w aplikacji: **tekst biblijny czyta każdy, bez logowania**.
 * Konto jest potrzebne dopiero do zapisu stanu (postęp, ulubione, motyw),
 * bo ten stan ma się synchronizować między telefonem a laptopem.
 *
 * E-mail + hasło: gdy skonfigurowano SMTP (server/mail.ts), rejestracja wymaga
 * potwierdzenia adresu linkiem z maila, a hasło można zresetować. Bez SMTP konto jest
 * aktywne od razu (tryb deweloperski). Google włącza się samo,
 * gdy w środowisku są GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET — brak kluczy nie
 * jest błędem, po prostu znika przycisk „Zaloguj przez Google".
 */
import type { NextFunction, Request, Response } from "express";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { fromNodeHeaders } from "better-auth/node";
import { prisma } from "./db";
import { mailEnabled, resetPasswordMail, sendMail, verificationMail } from "./mail";

const isProd = process.env.NODE_ENV === "production";

const secret = process.env.BETTER_AUTH_SECRET;
if (isProd && !secret) {
  throw new Error("Brak BETTER_AUTH_SECRET — wygeneruj: openssl rand -base64 32");
}

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
export const googleEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

// Administratorzy z ADMIN_EMAILS (lista po przecinku). To tylko sposób nadania pierwszej roli —
// dalej role zmienia się w panelu admina.
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Nadaje rolę admina kontom z ADMIN_EMAILS. Gdy działa wysyłka maili, wymagamy potwierdzonego
 * adresu — inaczej ktoś mógłby zarejestrować cudzy adres z listy, zanim zrobi to właściciel.
 * Wołane przy starcie i po każdej rejestracji/aktualizacji konta (np. potwierdzeniu e-maila).
 */
export async function promoteConfiguredAdmins() {
  if (adminEmails.length === 0) return;
  await prisma.user.updateMany({
    where: {
      email: { in: adminEmails, mode: "insensitive" },
      role: { not: "admin" },
      ...(mailEnabled ? { emailVerified: true } : {}),
    },
    data: { role: "admin" },
  });
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: secret ?? "dev-only-niebezpieczny-sekret-zmien-w-produkcji",
  baseURL: process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 5000}`,
  emailAndPassword: {
    enabled: true,
    // Bez SMTP nie ma jak wysłać linku, więc nie można wymagać potwierdzenia.
    requireEmailVerification: mailEnabled,
    autoSignIn: true,
    minPasswordLength: 8,
    resetPasswordTokenExpiresIn: 60 * 60,
    // Zmiana hasła kończy wszystkie sesje — jeśli ktoś przejął konto, traci dostęp.
    revokeSessionsOnPasswordReset: true,
    // Bez await (robi to Better Auth w tle): czas odpowiedzi nie zdradza, czy konto istnieje.
    sendResetPassword: async ({ user, url }) => {
      await sendMail(resetPasswordMail(user.email, user.name, url)).catch((err) =>
        console.error("Nie udało się wysłać maila z resetem hasła:", err),
      );
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // Świeży link przy próbie logowania na niepotwierdzone konto wysyła klient (login.tsx),
    // bo tylko on zna właściwy callbackURL.
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail(verificationMail(user.email, user.name, url)).catch((err) =>
        console.error("Nie udało się wysłać maila weryfikacyjnego:", err),
      );
    },
  },
  socialProviders: googleEnabled
    ? { google: { clientId: GOOGLE_CLIENT_ID!, clientSecret: GOOGLE_CLIENT_SECRET! } }
    : {},
  user: {
    additionalFields: {
      // Motyw zmienia się przez /api/me/theme, nie przez update konta.
      theme: { type: "string", required: false, defaultValue: "light", input: false },
      // Rolę nadaje wyłącznie serwer (ADMIN_EMAILS / panel admina) — nigdy klient.
      role: { type: "string", required: false, defaultValue: "user", input: false },
    },
  },
  databaseHooks: {
    user: {
      create: { after: async () => void (await promoteConfiguredAdmins().catch(logPromoteError)) },
      update: { after: async () => void (await promoteConfiguredAdmins().catch(logPromoteError)) },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 dni — czytnik, nie bankowość
    updateAge: 60 * 60 * 24, // odświeżenie sesji nie częściej niż raz dziennie
  },
  advanced: {
    cookies: { sessionToken: { attributes: { sameSite: "lax", secure: isProd } } },
    // Aplikacja stoi za reverse proxy (Traefik/Dokploy). Bez tego Better Auth nie
    // rozpozna IP klienta i wrzuci wszystkich do jednego kubełka rate limitu,
    // czyli jeden bot zablokowałby logowanie wszystkim.
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },
});

const logPromoteError = (err: unknown) => console.error("Nie udało się nadać roli admina:", err);

/**
 * Bramka dla /api/me/* — jedyne miejsce, które ustala tożsamość żądania.
 * Handlery tras pozostają bez zmian: czytają ją przez `getUserId(req)`.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) {
      return res.status(401).json({ message: "Zaloguj się, aby zapisywać postęp" });
    }
    req.userId = session.user.id;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Bramka dla /api/admin/* — sesja + rola admina odczytana z bazy przy KAŻDYM żądaniu
 * (nie z ciasteczka), więc odebranie roli działa natychmiast.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return res.status(401).json({ message: "Zaloguj się" });
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
    if (user?.role !== "admin") return res.status(403).json({ message: "Brak uprawnień" });
    req.userId = session.user.id;
    next();
  } catch (err) {
    next(err);
  }
}
