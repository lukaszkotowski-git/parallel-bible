import { flushSync } from "react-dom";
import type { AroundNavHandler } from "wouter";

/**
 * Nawigacja przez Link/useLocation idzie przez View Transitions API: przeglądarka robi zrzut
 * starej strony, flushSync renderuje nową synchronicznie, a CSS (`::view-transition-*` w
 * index.css) animuje różnicę. Bez wsparcia API albo przy „ogranicz ruch" — zwykła nawigacja.
 * Przyciski Wstecz/Dalej omijają ten handler (tak działa wouter) i przełączają się bez animacji.
 */
export const aroundNav: AroundNavHandler = (navigate, to, options) => {
  if (
    !document.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    navigate(to, options);
    return;
  }
  document.startViewTransition(() => {
    flushSync(() => navigate(to, options));
  });
};

/** Nazwa przejścia, pod którą tytuł księgi przepływa między kafelkiem a nagłówkami stron. */
export const BOOK_TITLE_VT = "book-title";

/**
 * Nazwa przejścia musi być unikalna na stronie, więc na liście ksiąg nosi ją tylko jeden tytuł
 * (element z `data-vt-book`): ten kliknięty, a po powrocie — z księgi, z której wracamy.
 * Ustawiamy ją bezpośrednio na DOM, bo zrzut starej strony powstaje, zanim React coś przerenderuje.
 */
let lastBookId: string | null = null;

export function nameBookTitle(bookId: string | null) {
  if (bookId) lastBookId = bookId;
  for (const el of document.querySelectorAll<HTMLElement>("[data-vt-book]")) {
    el.style.viewTransitionName = el.dataset.vtBook === lastBookId ? BOOK_TITLE_VT : "";
  }
}
