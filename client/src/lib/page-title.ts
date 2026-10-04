import { useEffect } from "react";

/** Tytuł z index.html — wraca, gdy strona z własnym tytułem znika (np. strona główna). */
const DEFAULT_TITLE = document.title;

/**
 * Tytuł karty przeglądarki dla bieżącej strony. Przy odmontowaniu przywraca domyślny, więc
 * strona bez własnego tytułu nigdy nie dziedziczy tytułu poprzedniej (np. „List do Rzymian 16"
 * na stronie logowania). `null`/pusty — dane jeszcze się ładują, tytuł się nie zmienia.
 */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    document.title = `${title} — Parallel Bible`;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
