import { createAuthClient } from "better-auth/react";

/**
 * Klient Better Auth. Bez `baseURL` — serwer API i klient stoją pod tym samym
 * originem (jeden proces Express), więc ciasteczko sesji jedzie same-origin.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;

/** Czy pokazywać przycisk „Zaloguj przez Google" — zależy od kluczy na serwerze. */
export async function fetchAuthConfig() {
  const res = await fetch("/api/config");
  if (!res.ok) return { google: false, mail: false };
  return (await res.json()) as { google: boolean; mail: boolean };
}

/** Po powrocie z OAuth wracamy na stronę główną (routing jest hash-owy). */
export const OAUTH_CALLBACK_URL = `${window.location.origin}/#/`;

/**
 * Po kliknięciu linku z maila Better Auth przekierowuje tutaj. Parametr zapytania stoi PRZED
 * hashem (routing jest hash-owy), więc odczytuje go AuthLinkNotices w App.tsx.
 */
export const VERIFIED_CALLBACK_URL = `${window.location.origin}/?verified=1#/`;

/** Link z maila o resecie hasła; Better Auth dokleja `?token=…` przed hashem. */
export const RESET_REDIRECT_URL = `${window.location.origin}/#/reset-hasla`;
