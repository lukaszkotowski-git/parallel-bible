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
  if (!res.ok) return { google: false };
  return (await res.json()) as { google: boolean };
}

/** Po powrocie z OAuth wracamy na stronę główną (routing jest hash-owy). */
export const OAUTH_CALLBACK_URL = `${window.location.origin}/#/`;
