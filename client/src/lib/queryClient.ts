import { QueryClient, QueryFunction } from "@tanstack/react-query";

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    // X-Timezone: serwer liczy „dziś", serie i cel dzienny w kalendarzu użytkownika.
    headers: { "X-Timezone": TIME_ZONE, ...(data ? { "Content-Type": "application/json" } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

/**
 * Komunikat błędu do pokazania użytkownikowi. Serwer zwraca czytelne `{ message }` po polsku
 * („To ostatni administrator") — te pokazujemy wprost; awarie sieci, limity i błędy 5xx
 * (gdzie treścią bywa „Internal Server Error" albo HTML proxy) zamieniamy na zrozumiały tekst.
 */
export function apiErrorText(e: unknown): string {
  if (!(e instanceof Error)) return "Spróbuj ponownie.";
  const match = /^(\d{3}):\s*([\s\S]*)$/.exec(e.message);
  // fetch rzuca TypeError („Failed to fetch") bez statusu — brak połączenia albo serwer leży.
  if (!match) return "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.";
  const status = Number(match[1]);
  if (status === 429) return "Za dużo prób naraz. Odczekaj chwilę i spróbuj ponownie.";
  if (status >= 500) return "Serwer chwilowo nie odpowiada. Spróbuj ponownie za chwilę.";
  try {
    const body = JSON.parse(match[2]!) as { message?: unknown };
    if (typeof body.message === "string" && body.message) return body.message;
  } catch {
    /* treść nie jest JSON-em — niżej zwykły tekst */
  }
  return match[2] && match[2].length < 200 && !match[2].startsWith("<") ? match[2] : "Spróbuj ponownie.";
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, { headers: { "X-Timezone": TIME_ZONE } });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
