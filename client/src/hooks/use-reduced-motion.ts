import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Czy użytkownik prosi system o ograniczenie ruchu. Reaguje na zmianę ustawienia w locie.
 * Zastępuje `useReducedMotion` z framer-motion — tylko po to trzymaliśmy ~100 KB biblioteki.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
