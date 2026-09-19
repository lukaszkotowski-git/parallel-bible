import { BOOK_BY_ID } from "@shared/books";

/** „Jana 3" — krótka nazwa księgi + rozdział, do linków i etykiet. */
export const chapterLabel = (bookId: string, chapter: number) =>
  `${BOOK_BY_ID[bookId]?.shortPl ?? bookId} ${chapter}`;

export const chapterHref = (bookId: string, chapter: number) => `/czytaj/${bookId}/${chapter}`;

/** Polska odmiana: 1 rozdział, 2 rozdziały, 5 rozdziałów. */
export function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const last = n % 10;
  const teen = n % 100;
  return last >= 2 && last <= 4 && !(teen >= 12 && teen <= 14) ? few : many;
}
