import { useSyncExternalStore } from "react";

/**
 * Ustawienia czytania (rozmiar, krój, szerokość kolumny) to preferencja urządzenia,
 * a nie konta — czytelność zależy od ekranu — więc żyją w localStorage
 * i działają też bez logowania. Trafiają do CSS przez zmienne na <html>.
 */
export interface ReadingSettings {
  /** Mnożnik rozmiaru tekstu Pisma. */
  scale: number;
  font: "serif" | "sans";
  width: "narrow" | "normal" | "wide";
}

export const SCALE_STEPS = [0.9, 1, 1.15, 1.3, 1.5] as const;
const DEFAULTS: ReadingSettings = { scale: 1, font: "serif", width: "normal" };
const KEY = "pb-reading";
const WIDTHS = { narrow: "34rem", normal: "48rem", wide: "60rem" } as const;

function load(): ReadingSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!raw || typeof raw !== "object") return DEFAULTS;
    return {
      scale: (SCALE_STEPS as readonly number[]).includes(raw.scale) ? raw.scale : DEFAULTS.scale,
      font: raw.font === "sans" ? "sans" : "serif",
      width: raw.width in WIDTHS ? raw.width : DEFAULTS.width,
    };
  } catch {
    return DEFAULTS;
  }
}

let current = load();
const listeners = new Set<() => void>();

export function applyReadingSettings(s: ReadingSettings = current) {
  const root = document.documentElement.style;
  root.setProperty("--reading-scale", String(s.scale));
  root.setProperty("--reading-font", s.font === "sans" ? "var(--font-sans)" : "var(--font-serif)");
  root.setProperty("--reading-width", WIDTHS[s.width]);
}

export function updateReadingSettings(patch: Partial<ReadingSettings>) {
  current = { ...current, ...patch };
  applyReadingSettings(current);
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* tryb prywatny — ustawienia nie przetrwają odświeżenia */
  }
  for (const l of listeners) l();
}

export function useReadingSettings(): ReadingSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
