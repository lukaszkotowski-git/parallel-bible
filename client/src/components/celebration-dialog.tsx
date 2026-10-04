import { useRef } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ChevronsUp, Target, Trophy } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { badgeIcon } from "@/lib/badge-icons";
import { gsap, useGSAP } from "@/lib/gsap";
import { dismissCelebration, useCelebration } from "@/lib/rewards";

// Konfetti w kolorach palety (bez turkusu i różu spoza systemu). Kształt/rozmiar/kolor są stałe,
// a tor ruchu losuje GSAP przy starcie animacji. Przy „ogranicz ruch" konfetti się nie renderuje.
const PALETTE = ["--primary", "--chart-4", "--read-marker", "--chart-3", "--chart-5"];
const CONFETTI = Array.from({ length: 30 }, (_, i) => ({
  size: 6 + ((i * 7) % 6),
  color: `hsl(var(${PALETTE[i % PALETTE.length]}))`,
  round: i % 3 === 0,
}));

/** Wybuch spod ikony: szybki wznios (zwalnia), potem opadanie z przyspieszeniem, dryf i obrót. */
function Confetti() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useGSAP(
    () => {
      if (reduce || !ref.current) return;
      const pieces = gsap.utils.toArray<HTMLElement>("[data-piece]", ref.current);
      for (const el of pieces) {
        const drift = gsap.utils.random(-150, 150);
        const rise = gsap.utils.random(-130, -50);
        const fall = gsap.utils.random(230, 330);
        gsap
          .timeline({ delay: gsap.utils.random(0, 0.25) })
          .set(el, { opacity: 1 })
          .to(el, { x: drift, y: rise, duration: 0.5, ease: "power2.out" })
          .to(el, { x: drift * 1.25 + gsap.utils.random(-30, 30), y: rise + fall, duration: 1.5, ease: "power1.in" })
          .to(el, { rotation: gsap.utils.random(-540, 540), duration: 2, ease: "none" }, 0)
          .to(el, { scaleX: 0.25, duration: 0.22, ease: "sine.inOut", yoyo: true, repeat: 7 }, 0.2)
          .to(el, { opacity: 0, duration: 0.5, ease: "power1.in" }, 1.5);
      }
    },
    { scope: ref, dependencies: [reduce] },
  );
  if (reduce) return null;
  return (
    <div ref={ref} className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden" aria-hidden="true">
      {CONFETTI.map((c, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: stała lista dekoracji
          key={i}
          data-piece
          className={`absolute left-1/2 top-24 block opacity-0 ${c.round ? "rounded-full" : "rounded-[2px]"}`}
          style={{ width: c.size, height: c.size, backgroundColor: c.color }}
        />
      ))}
    </div>
  );
}

/**
 * Okno gratulacji za osiągnięcia (odznaki, awans, cel dnia). Montowane raz w App;
 * kolejne osiągnięcia czekają w kolejce i pokazują się po zamknięciu poprzedniego.
 */
export function CelebrationHost() {
  const c = useCelebration();
  if (!c) return null;

  const Icon = c.badges.length > 0 ? badgeIcon(c.badges[0]!.icon) : c.level ? ChevronsUp : Target;
  const title =
    c.badges.length > 1 ? "Nowe odznaki!" : c.badges.length === 1 ? "Nowa odznaka!" : c.level ? "Awans!" : "Cel dnia osiągnięty!";

  return (
    <Dialog open onOpenChange={(open) => !open && dismissCelebration()}>
      <DialogContent className="max-w-sm overflow-hidden text-center" data-testid="dialog-celebration">
        <Confetti />
        <div className="relative flex flex-col items-center pt-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary ring-4 ring-primary/20 motion-safe:animate-celebrate-pop">
            <Icon className="h-9 w-9" aria-hidden="true" />
          </div>

          <DialogTitle className="mt-4 font-display text-2xl font-bold">{title}</DialogTitle>

          {c.badges.length > 0 && (
            <ul className="mt-3 space-y-2">
              {c.badges.map((b) => {
                const BadgeIcon = badgeIcon(b.icon);
                return (
                  <li key={b.id}>
                    <p className="flex items-center justify-center gap-1.5 font-semibold">
                      {c.badges.length > 1 && <BadgeIcon className="h-4 w-4 text-primary" aria-hidden="true" />}
                      {b.name}
                    </p>
                    <p className="text-sm text-muted-foreground">{b.description}</p>
                  </li>
                );
              })}
            </ul>
          )}

          {c.level && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm">
              <ChevronsUp className="h-4 w-4 text-primary" aria-hidden="true" />
              Poziom {c.level.level}: <strong className="font-semibold">{c.level.name}</strong>
            </p>
          )}

          {c.goal && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm">
              <Target className="h-4 w-4 text-primary" aria-hidden="true" />
              {c.badges.length === 0 && !c.level
                ? `Przeczytane ${c.goal.chapters} ${c.goal.chapters === 1 ? "rozdział" : "rozdz."} dziś — tak trzymaj!`
                : "Cel dnia też osiągnięty!"}
            </p>
          )}

          <DialogDescription className="sr-only">Gratulacje za osiągnięcie w czytaniu.</DialogDescription>

          <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button autoFocus onClick={dismissCelebration} data-testid="button-celebration-close">
              Super!
            </Button>
            {c.badges.length > 0 && (
              <Button asChild variant="ghost" onClick={dismissCelebration}>
                <Link href="/odznaki">Zobacz odznaki</Link>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
