import { useState } from "react";
import { BookOpen, Languages } from "lucide-react";

interface ChapterCommentaryProps {
  commentary: { en: string; pl: string };
}

/**
 * Krótkie streszczenie rozdziału, wyraźnie oddzielone od tekstu biblijnego:
 * domyślnie zwinięte, sans-serif (kontrast z serifowym tekstem Pisma), własna
 * ramka. Domyślny język to EN, z możliwością podejrzenia PL — spójnie z tym,
 * że angielski czyta się od razu, a polski jest "odkrywany".
 */
export function ChapterCommentary({ commentary }: ChapterCommentaryProps) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"en" | "pl">("en");

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
          <p className="text-sm leading-relaxed text-foreground" data-testid="text-commentary">
            {commentary[lang]}
          </p>
          <button
            type="button"
            onClick={() => setLang((l) => (l === "en" ? "pl" : "en"))}
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            data-testid="button-toggle-commentary-lang"
          >
            <Languages className="h-3 w-3" />
            {lang === "en" ? "Zobacz po polsku" : "Zobacz po angielsku"}
          </button>
        </div>
      )}
    </div>
  );
}
