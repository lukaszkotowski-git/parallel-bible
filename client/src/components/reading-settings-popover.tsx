import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Minus, Plus, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TranslationSelects } from "@/components/translation-selects";
import {
  SCALE_STEPS,
  updateReadingSettings,
  useReadingSettings,
  type ReadingSettings,
} from "@/lib/reading-settings";
import { cn } from "@/lib/utils";

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <fieldset
      aria-label={label}
      className={cn("m-0 grid min-w-0 auto-cols-fr grid-flow-col gap-1 rounded-md border-0 bg-muted p-1", className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-11 rounded px-2 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9",
            value === o.value ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}

/** Wiersz „etykieta + kontrolka" — w wersji zwartej (arkusz na telefonie) jedna linia zamiast dwóch. */
function Field({ label, compact, children }: { label: string; compact?: boolean; children: React.ReactNode }) {
  return compact ? (
    <div className="flex items-center justify-between gap-3">
      <p className="shrink-0 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  ) : (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

/** Treść „Widoku": para tłumaczeń oraz rozmiar, krój i szerokość kolumny (te trzy zapisują się na urządzeniu). */
function SettingsBody({ compact }: { compact?: boolean }) {
  const settings = useReadingSettings();
  const idx = SCALE_STEPS.indexOf(settings.scale as (typeof SCALE_STEPS)[number]);
  const step = (d: number) => updateReadingSettings({ scale: SCALE_STEPS[idx + d]! });

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <TranslationSelects compact={compact} />
      <div className="border-t border-border" />
      <Field label="Rozmiar tekstu" compact={compact}>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 sm:h-10 sm:w-10"
            disabled={idx <= 0}
            onClick={() => step(-1)}
            aria-label="Zmniejsz tekst"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="flex-1 text-center text-sm tabular-nums" aria-live="polite">
            {Math.round(settings.scale * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 sm:h-10 sm:w-10"
            disabled={idx >= SCALE_STEPS.length - 1}
            onClick={() => step(1)}
            aria-label="Powiększ tekst"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </Field>
      <Field label="Krój" compact={compact}>
        <Choice<ReadingSettings["font"]>
          label="Krój pisma"
          value={settings.font}
          onChange={(font) => updateReadingSettings({ font })}
          options={[
            { value: "serif", label: "Szeryfowy" },
            { value: "sans", label: "Bezszeryfowy" },
          ]}
        />
      </Field>
      <Field label="Szerokość" compact={compact}>
        <Choice<ReadingSettings["width"]>
          label="Szerokość kolumny"
          value={settings.width}
          onChange={(width) => updateReadingSettings({ width })}
          options={[
            { value: "narrow", label: "Wąska" },
            { value: "normal", label: "Średnia" },
            { value: "wide", label: "Szeroka" },
          ]}
        />
      </Field>
    </div>
  );
}

/**
 * „Widok". Na desktopie: popover pod przyciskiem z aktualną parą (np. „WEB → BG"). Na telefonie
 * (`compact`, dolny pasek): arkusz od dołu bez przyciemniania i bez blokowania strony, zajmujący
 * co najwyżej ~45% ekranu — nad nim widać i można przewijać tekst, który zmieniasz.
 */
export function ReadingSettingsPopover({
  pair,
  pairLong,
  compact,
}: {
  /** Krótki opis pary (np. „WEB → BG"), pokazywany na przycisku. */
  pair?: string;
  /** Pełne nazwy — od `sm` w górę zamiast skrótów. */
  pairLong?: string;
  /** Wersja na telefon: przycisk z ikoną i podpisem, treść w arkuszu od dołu. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <DialogPrimitive.Root modal={false}>
        <DialogPrimitive.Trigger asChild>
          <Button
            variant="ghost"
            className="h-11 min-w-11 flex-col gap-0.5 px-1 text-[0.625rem] font-medium leading-none text-muted-foreground"
            aria-label="Widok i ustawienia czytania"
            data-testid="button-reading-settings-compact"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Widok
          </Button>
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            tabIndex={-1}
            // Fokus na sam arkusz, nie na pierwszy select (ciężki pierścień przy otwarciu).
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).focus();
            }}
            // Arkusz zamyka przycisk X i Esc; dotknięcie tekstu (przewijanie, podgląd) go nie zamyka.
            onInteractOutside={(e) => e.preventDefault()}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[45vh] overflow-y-auto rounded-t-xl border-t border-border bg-popover px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:duration-200 data-[state=open]:duration-200"
          >
            <div className="flex items-center justify-between">
              <DialogPrimitive.Title className="font-display text-base font-bold">Widok</DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" className="-mr-2 h-11 w-11" aria-label="Zamknij widok">
                  <X className="h-4 w-4" />
                </Button>
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Description className="sr-only">
              Tłumaczenia oraz rozmiar, krój i szerokość tekstu. Zmiany widać od razu w tekście nad arkuszem.
            </DialogPrimitive.Description>
            <SettingsBody compact />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-reading-settings">
          <SlidersHorizontal className="h-4 w-4" />
          {pair ? (
            <>
              <span className="sr-only">Widok: </span>
              <span className={pairLong ? "sm:hidden" : undefined}>{pair}</span>
              {pairLong && <span className="hidden sm:inline">{pairLong}</span>}
            </>
          ) : (
            "Widok"
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
        <SettingsBody />
      </PopoverContent>
    </Popover>
  );
}
