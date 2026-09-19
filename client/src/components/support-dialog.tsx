import { useState } from "react";
import { Check, Copy, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAppConfig } from "@/lib/auth";
import type { SupportConfig } from "@shared/schema";
import { cn } from "@/lib/utils";

/** 123456789 → „123 456 789". Inne długości zostawiamy bez formatowania. */
const formatPhone = (d: string) => (d.length === 9 ? d.replace(/(\d{3})(?=\d)/g, "$1 ") : d);
/** 26 cyfr → „12 3456 7890 …" (standardowy zapis polskiego rachunku). */
const formatAccount = (d: string) =>
  d.length === 26 ? `${d.slice(0, 2)} ${d.slice(2).replace(/(\d{4})(?=\d)/g, "$1 ")}` : d;

/** Wiersz z wartością i przyciskiem „Kopiuj". Kopiujemy wartość bez spacji (łatwo wkleić do banku). */
function CopyRow({ label, display, copy, testId }: { label: string; display: string; copy: string; testId: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(copy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Brak dostępu do schowka (np. HTTP, stara przeglądarka) — pokazujemy wartość do ręcznego skopiowania.
      toast({ title: "Skopiuj ręcznie", description: copy, duration: 8000 });
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-3">
        <p className="min-w-0 flex-1 select-all break-words font-mono text-base leading-snug" data-testid={`${testId}-value`}>
          {display}
        </p>
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={doCopy} aria-label={`Kopiuj: ${label}`} data-testid={`${testId}-copy`}>
          {copied ? <Check className="mr-1.5 h-4 w-4 text-read-marker" /> : <Copy className="mr-1.5 h-4 w-4" />}
          {copied ? "Skopiowano" : "Kopiuj"}
        </Button>
      </div>
      <span className="sr-only" aria-live="polite">{copied ? "Skopiowano do schowka" : ""}</span>
    </div>
  );
}

export function SupportDisclaimer() {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Wpłata nie daje dostępu do produktu, usługi ani innych świadczeń. Dziękuję za każde wsparcie. 🙏
    </p>
  );
}

/** Proponowane kwoty (zł) — tylko podpowiedź, wpłacić można dowolną. */
const SUGGESTED_AMOUNTS = [5, 10, 30, 77] as const;

/** Kafelki z proponowanymi kwotami; wybrana kwota pojawia się niżej jako pole do skopiowania. */
function AmountTiles({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" aria-label="Proponowane kwoty">
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Proponowana kwota</p>
      <div className="grid grid-cols-4 gap-2">
        {SUGGESTED_AMOUNTS.map((amount) => {
          const selected = value === amount;
          return (
            <button
              key={amount}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : amount)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-foreground hover:border-primary/40 hover:bg-primary/5",
              )}
              data-testid={`amount-${amount}`}
            >
              <span className="font-display text-xl font-bold leading-none tabular-nums">{amount}</span>
              <span className="mt-1 text-xs text-muted-foreground">zł</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Pola do skopiowania: tytuł, BLIK na telefon, numer konta, odbiorca. Współdzielone z oknem po 15 rozdziałach. */
export function SupportRows({ support }: { support: SupportConfig }) {
  const [amount, setAmount] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      <AmountTiles value={amount} onChange={setAmount} />
      {amount !== null && (
        <CopyRow label="Kwota" display={`${amount} zł`} copy={String(amount)} testId="support-amount" />
      )}
      <CopyRow label="Tytuł przelewu" display={support.title} copy={support.title} testId="support-title" />
      {support.phone && (
        <CopyRow label="BLIK na numer telefonu" display={formatPhone(support.phone)} copy={support.phone} testId="support-phone" />
      )}
      {support.account && (
        <CopyRow label="Numer konta" display={formatAccount(support.account)} copy={support.account} testId="support-account" />
      )}
      {support.recipient && support.account && (
        <CopyRow label="Odbiorca" display={support.recipient} copy={support.recipient} testId="support-recipient" />
      )}
    </div>
  );
}

/**
 * „Wesprzyj" — dobrowolna darowizna BLIK-iem na telefon albo przelewem. Numery i tytuł idą ze
 * zmiennych środowiskowych (patrz /api/config); bez nich przycisk się nie pokazuje.
 * `icon` — kompaktowy w nagłówku, `pill` — pełny przycisk w treści strony.
 */
export function SupportButton({ variant = "pill", className }: { variant?: "icon" | "pill"; className?: string }) {
  const { data } = useAppConfig();
  const support = data?.support;
  if (!support) return null;

  return (
    <Dialog>
      {variant === "icon" ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className={cn("h-9 w-9", className)} aria-label="Wesprzyj projekt" data-testid="button-support">
                <Heart className="h-4 w-4 fill-primary/20 text-primary" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Wesprzyj projekt</TooltipContent>
        </Tooltip>
      ) : (
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
            data-testid="button-support-pill"
          >
            <Heart className="h-4 w-4 fill-primary/20" aria-hidden="true" /> Wesprzyj projekt
          </button>
        </DialogTrigger>
      )}

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Heart className="h-5 w-5 fill-primary/20 text-primary" aria-hidden="true" /> Wesprzyj Parallel Bible
          </DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            Spodobała Ci się Parallel Bible? Jeśli chcesz dobrowolnie wesprzeć rozwój projektu i utrzymanie
            serwerów, możesz wysłać mi darowiznę na numer konta lub numer telefonu za pomocą BLIK.
          </DialogDescription>
        </DialogHeader>

        <SupportRows support={support} />

        <p className="text-xs leading-relaxed text-muted-foreground">
          Dziękuję za każde wsparcie. 🙏
        </p>
      </DialogContent>
    </Dialog>
  );
}
