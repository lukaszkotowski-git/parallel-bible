import { useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { gsap, useGSAP } from "@/lib/gsap";

/**
 * Liczba, która dobiega do wartości (0 → value, ~0,9 s, ease-out). Zmiana wartości dobiega od poprzedniej.
 * Przy „ogranicz ruch" i w ukrytej karcie od razu pokazuje wynik. Tekst ustawia efekt (przed pierwszym
 * malowaniem), więc czytnik ekranu dostaje zwykły węzeł tekstowy z końcową liczbą.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const reduce = useReducedMotion();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const paint = (v: number) => {
        shown.current = v;
        el.textContent = String(Math.round(v));
      };
      if (reduce || document.hidden || value === shown.current) {
        paint(value);
        return;
      }
      const state = { v: shown.current };
      paint(state.v);
      const tween = gsap.to(state, { v: value, duration: 0.9, ease: "power2.out", onUpdate: () => paint(state.v) });
      return () => {
        tween.kill();
        paint(value);
      };
    },
    { dependencies: [value, reduce] },
  );

  return <span ref={ref} className={className} />;
}
