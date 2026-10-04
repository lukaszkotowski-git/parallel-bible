import { useRef } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { gsap, useGSAP } from "@/lib/gsap";

/**
 * Tło „światła" za nagłówkiem strony: snop z góry i dwie wolno dryfujące plamy w kolorze
 * `primary` (5–10% krycia) plus lekkie ziarno. Całość wygasa ku dołowi (maska w `.ambient-light`),
 * więc nie sięga pod listę ksiąg ani tekst. Czysto dekoracyjne — rodzic musi być `relative`
 * i tworzyć kontekst warstw (strony mają `relative z-10`), żeby -z-10 trafiło pod treść.
 *
 * Na urządzeniach z myszą warstwy delikatnie podążają za kursorem w przeciwną stronę (paralaksa,
 * różna głębia). Plamy dryfują CSS-em po `transform`, więc GSAP przesuwa ich osobne opakowania.
 */
export function AmbientLight() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useGSAP(
    () => {
      const root = ref.current;
      if (!root || reduce || !window.matchMedia("(pointer: fine)").matches) return;
      const layers = gsap.utils.toArray<HTMLElement>("[data-depth]", root).map((el) => ({
        depth: Number(el.dataset.depth),
        x: gsap.quickTo(el, "x", { duration: 1.4, ease: "power3.out" }),
        y: gsap.quickTo(el, "y", { duration: 1.4, ease: "power3.out" }),
      }));
      const move = (e: PointerEvent) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        for (const l of layers) {
          l.x(-nx * 40 * l.depth);
          l.y(-ny * 26 * l.depth);
        }
      };
      window.addEventListener("pointermove", move, { passive: true });
      return () => window.removeEventListener("pointermove", move);
    },
    { scope: ref, dependencies: [reduce] },
  );

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="ambient-light pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden"
    >
      <div className="ambient-light__beam" data-depth="0.35" />
      <div className="absolute inset-0" data-depth="0.8">
        <div className="ambient-light__orb ambient-light__orb--a" />
      </div>
      <div className="absolute inset-0" data-depth="1.2">
        <div className="ambient-light__orb ambient-light__orb--b" />
      </div>
      <div className="ambient-light__grain" />
    </div>
  );
}
