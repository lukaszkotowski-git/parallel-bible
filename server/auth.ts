/**
 * Konfiguracja Better Auth.
 *
 * Zasada podziału w aplikacji: **tekst biblijny czyta każdy, bez logowania**.
 * Konto jest potrzebne dopiero do zapisu stanu (postęp, ulubione, motyw),
 * bo ten stan ma się synchronizować między telefonem a laptopem.
 *
 * E-mail + hasło działa bez żadnej zewnętrznej usługi. Google włącza się samo,
 * gdy w środowisku są GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET — brak kluczy nie
 * jest błędem, po prostu znika przycisk „Zaloguj przez Google".
 */
import type { NextFunction, Request, Response } from "express";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { fromNodeHeaders } from "better-auth/node";
import { prisma } from "./db";

const isProd = process.env.NODE_ENV === "production";

const secret = process.env.BETTER_AUTH_SECRET;
if (isProd && !secret) {
  throw new Error("Brak BETTER_AUTH_SECRET — wygeneruj: openssl rand -base64 32");
}

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
export const googleEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: secret ?? "dev-only-niebezpieczny-sekret-zmien-w-produkcji",
  baseURL: process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 5000}`,
  emailAndPassword: {
    enabled: true,
    // Bez wysyłki e-maili (brak SMTP) — konto jest aktywne od razu po rejestracji.
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  socialProviders: googleEnabled
    ? { google: { clientId: GOOGLE_CLIENT_ID!, clientSecret: GOOGLE_CLIENT_SECRET! } }
    : {},
  user: {
    additionalFields: {
      // Motyw zmienia się przez /api/me/theme, nie przez update konta.
      theme: { type: "string", required: false, defaultValue: "light", input: false },
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
