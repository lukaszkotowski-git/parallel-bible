import { ChevronsUp, Target, Trophy } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { badgeIcon } from "@/lib/badge-icons";
import { dismissCelebration, useCelebration } from "@/lib/rewards";

// Konfetti bez losowości (stały układ = stabilny render); wyłączane przez `motion-safe:`,
// więc przy „ogranicz ruch" zostaje spokojne okno z animowaną ikoną w wersji statycznej.
const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${((i * 53) % 90) / 100}s`,
  size: 6 + ((i * 7) % 6),
  color: ["bg-primary", "bg-amber-400", "bg-emerald-500", "bg-sky-500", "bg-rose-400"][i % 5],
  round: i % 3 === 0,
}));

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-60 overflow-hidden" aria-hidden="true">
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className={`absolute top-0 block motion-safe:animate-confetti-fall motion-reduce:hidden ${c.color} ${c.round ? "rounded-full" : "rounded-[2px]"}`}
          style={{ left: c.left, width: c.size, height: c.size, animationDelay: c.delay }}
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
