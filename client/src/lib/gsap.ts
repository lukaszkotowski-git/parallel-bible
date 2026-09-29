import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { useGSAP } from "@gsap/react";

// Jedno miejsce rejestracji wtyczek — komponenty importują stąd, nie z „gsap" bezpośrednio.
gsap.registerPlugin(useGSAP, SplitText, DrawSVGPlugin);

export { gsap, SplitText, useGSAP };

/** Czy element jest w pobliżu okna (±pół ekranu) — poza nim nie warto animować, tylko ustawić stan końcowy. */
export function nearViewport(el: Element | null): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > -window.innerHeight * 0.5 && r.top < window.innerHeight * 1.5;
}
