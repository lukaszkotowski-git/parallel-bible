/**
 * Ostatnie miejsce czytania dla osób bez konta — „Kontynuuj czytanie" ma działać
 * także anonimowo. Po zalogowaniu pozycja z konta ma pierwszeństwo (patrz home.tsx).
 */
const KEY = "pb-position";

export interface LocalPosition {
  bookId: string;
  chapter: number;
}

export function saveLocalPosition(pos: LocalPosition) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pos));
  } catch {
    /* brak localStorage — zwykłe czytanie działa dalej */
  }
}

export function readLocalPosition(): LocalPosition | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw && typeof raw.bookId === "string" && Number.isInteger(raw.chapter) && raw.chapter > 0) {
      return { bookId: raw.bookId, chapter: raw.chapter };
    }
  } catch {
    /* uszkodzony wpis — traktujemy jak brak */
  }
  return null;
}
