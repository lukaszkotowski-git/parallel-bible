import { useState } from "react";
import { Frown, Heart, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SupportDisclaimer, SupportRows } from "@/components/support-dialog";
import { answerNudge } from "@/lib/api";
import { useAppConfig } from "@/lib/auth";
import { plural } from "@/lib/format";
import { NUDGE_EVERY_RARE } from "@shared/gamification";

type Step = "ask" | "support";

/**
 * Okno „jak Ci się podoba aplikacja?" po każdych 15 przeczytanych rozdziałach.
 * 🙂 → podziękowanie i propozycja dobrowolnego wsparcia (z numerami do skopiowania),
 * 🙁 → okno się zamyka. Checkbox przełącza na rzadsze pytanie (co 77 rozdziałów).
 * Zamknięcie krzyżykiem liczy się jak „nie teraz" — też przesuwa kolejne pytanie.
 * Bez skonfigurowanych numerów wsparcia okno w ogóle się nie pokazuje.
 */
export function SupportNudge({ chapters, onClose }: { chapters: number; onClose: () => void }) {
  const { data } = useAppConfig();
  const support = data?.support;
  const [step, setStep] = useState<Step>("ask");
  const [rare, setRare] = useState(false);

  if (!support) return null;

  // Zapis nie blokuje UI: ewentualny błąd sieci oznacza tylko, że zapytamy jeszcze raz przy następnym rozdziale.
  const record = () => {
    answerNudge(rare).catch(() => undefined);
  };
  const finish = () => {
    record();
    onClose();
  };
  const choose = (positive: boolean) => {
    if (positive) {
      record();
      setStep("support");
    } else {
      finish();
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && finish()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" data-testid="support-nudge">
        {step === "ask" ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Jak Ci się podoba Parallel Bible?</DialogTitle>
              <DialogDescription className="text-left leading-relaxed">
                Przeczytałeś już {chapters} {plural(chapters, "rozdział", "rozdziały", "rozdziałów")}. Jak dotychczas
                podobała Ci się aplikacja?
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-auto flex-col gap-1.5 py-4" onClick={() => choose(true)} data-testid="nudge-positive">
                <Smile className="h-8 w-8 text-primary" aria-hidden="true" />
                <span>Tak, podoba mi się</span>
              </Button>
              <Button variant="outline" className="h-auto flex-col gap-1.5 py-4" onClick={() => choose(false)} data-testid="nudge-negative">
                <Frown className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <span>Nie bardzo</span>
              </Button>
            </div>

            <div className="flex items-start gap-2.5">
              <Checkbox id="nudge-rare" checked={rare} onCheckedChange={(v) => setRare(v === true)} className="mt-0.5" data-testid="nudge-rare" />
              <label htmlFor="nudge-rare" className="text-sm leading-snug text-muted-foreground">
                Nie pokazuj tego więcej — zapytam Cię ponownie dopiero za {NUDGE_EVERY_RARE} rozdziałów.
              </label>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display">
                <Heart className="h-5 w-5 fill-primary/20 text-primary" aria-hidden="true" /> Cieszę się!
              </DialogTitle>
              <DialogDescription className="text-left leading-relaxed">
                Miło słyszeć. Jeśli chcesz dobrowolnie wesprzeć rozwój projektu i utrzymanie serwerów, możesz wysłać mi
                darowiznę na numer konta lub numer telefonu za pomocą BLIK.
              </DialogDescription>
            </DialogHeader>
            <SupportRows support={support} />
            <SupportDisclaimer />
            <Button variant="ghost" className="w-full" onClick={onClose} data-testid="nudge-close">
              Zamknij
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
