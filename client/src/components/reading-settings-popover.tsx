import { Minus, Plus, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset aria-label={label} className="m-0 grid min-w-0 auto-cols-fr grid-flow-col gap-1 rounded-md border-0 bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}

/** Rozmiar, krój i szerokość kolumny tekstu — zapisywane na urządzeniu. */
export function ReadingSettingsPopover() {
  const settings = useReadingSettings();
  const idx = SCALE_STEPS.indexOf(settings.scale as (typeof SCALE_STEPS)[number]);
  const step = (d: number) => updateReadingSettings({ scale: SCALE_STEPS[idx + d]! });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Ustawienia czytania" data-testid="button-reading-settings">
          <Type className="mr-1.5 h-4 w-4" /> Tekst
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Rozmiar tekstu</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={idx <= 0} onClick={() => step(-1)} aria-label="Zmniejsz tekst">
              <Minus className="h-4 w-4" />
            </Button>
            <span className="flex-1 text-center text-sm tabular-nums" aria-live="polite">
              {Math.round(settings.scale * 100)}%
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={idx >= SCALE_STEPS.length - 1} onClick={() => step(1)} aria-label="Powiększ tekst">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Krój</p>
          <Choice<ReadingSettings["font"]>
            label="Krój pisma"
            value={settings.font}
            onChange={(font) => updateReadingSettings({ font })}
            options={[
              { value: "serif", label: "Szeryfowy" },
              { value: "sans", label: "Bezszeryfowy" },
            ]}
          />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Szerokość kolumny</p>
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
