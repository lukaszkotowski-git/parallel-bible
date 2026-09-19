// Wybór pary tłumaczeń: „czytam" (ciągły tekst) i „odsłaniam" (po kliknięciu wersetu).
// Wspólne dla serwera (walidacja żądań) i klienta (stan wyboru), żeby oba zawsze
// rozstrzygały nieprawidłowe lub niedostępne wartości tak samo.

export const DEFAULT_READ = "WEB";
export const DEFAULT_ALT = "BG";

/** Nazwy języków do grupowania w selektorach (kod ISO → etykieta po polsku). */
export const LANGUAGE_LABELS: Record<string, string> = {
  en: "Angielski",
  pl: "Polski",
  es: "Hiszpański",
};

/**
 * Zwraca parę, która na pewno istnieje w `available` i nie ma dwóch takich samych tłumaczeń.
 * Nieznane wartości cofają się do domyślnych; przy kolizji zmienia się tłumaczenie odsłaniane.
 */
export function resolvePair(
  read: string | null | undefined,
  alt: string | null | undefined,
  available: string[],
): { read: string; alt: string } {
  const has = (id: string | null | undefined): id is string => !!id && available.includes(id);
  const r = has(read) ? read : DEFAULT_READ;
  let a = has(alt) ? alt : DEFAULT_ALT;
  if (a === r) a = [DEFAULT_ALT, DEFAULT_READ, ...available].find((id) => id !== r && available.includes(id)) ?? a;
  return { read: r, alt: a };
}
