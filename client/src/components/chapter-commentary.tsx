import { useState } from "react";
import { BookOpen, Languages } from "lucide-react";

type SummaryLang = "en" | "pl";

interface ChapterCommentaryProps {
  commentary: { en: string; pl: string };
  /** Języki wybranej pary tłumaczeń — streszczenia istnieją tylko po angielsku i polsku. */
  readLang?: string;
  altLang?: string;
}

const isSummaryLang = (l: string | undefined): l is SummaryLang => l === "en" || l === "pl";

/**
 * Krótkie streszczenie rozdziału, wyraźnie oddzielone od tekstu biblijnego:
 * domyślnie zwinięte, sans-serif (kontrast z serifowym tekstem Pisma), własna
 * ramka. Domyślnie w języku czytanego tłumaczenia, z możliwością podejrzenia drugiego —
 * spójnie z tym, że jedno czyta się od razu, a drugie jest „odkrywane". Streszczenia są
 * generowane tylko po angielsku i polsku; dla innych języków pokazujemy tylko te dostępne.
 */
export function ChapterCommentary({ commentary, readLang, altLang }: ChapterCommentaryProps) {
  const [open, setOpen] = useState(false);
  const available = [...new Set([readLang, altLang].filter(isSummaryLang))];
  const [picked, setPicked] = useState<SummaryLang | null>(null);
  const lang = picked && available.includes(picked) ? picked : available[0];
  if (!lang) return null;
  const other = available.find((l) => l !== lang);

  return (
    <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        data-testid="button-toggle-commentary"
      >
        <BookOpen className="h-4 w-4 shrink-0" />
        Podsumowanie rozdziału
      </button>

      {open && (
        <div className="animate-verse-reveal border-t border-dashed border-border px-4 py-3">
          <p className="text-sm leading-relaxed text-foreground" lang={lang} data-testid="text-commentary">
            {commentary[lang]}
          </p>
          {other && (
            <button
              type="button"
              onClick={() => setPicked(other)}
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              data-testid="button-toggle-commentary-lang"
            >
              <Languages className="h-3 w-3" />
              {other === "pl" ? "Zobacz po polsku" : "Zobacz po angielsku"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
