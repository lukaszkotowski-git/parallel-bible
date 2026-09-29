import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Highlighter, Languages, Layers, MoreHorizontal, Pencil, StickyNote, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { gsap, nearViewport, SplitText, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { HIGHLIGHT_COLORS, type HighlightColor, type ParallelVerse } from "@shared/schema";

const COLOR_LABEL: Record<HighlightColor, string> = {
  yellow: "żółty",
  green: "zielony",
  blue: "niebieski",
  pink: "różowy",
};
// Pełne odpowiedniki półprzezroczystych teł `.hl-*` z index.css (te same odcienie, spokojniejsze nasycenie).
const SWATCH: Record<HighlightColor, string> = {
  yellow: "bg-[hsl(48_90%_56%)]",
  green: "bg-[hsl(142_45%_46%)]",
  blue: "bg-[hsl(212_65%_58%)]",
  pink: "bg-[hsl(330_65%_62%)]",
};

interface VerseRowProps {
  verse: ParallelVerse;
  /** Kody języków (ISO) — do atrybutu `lang`, żeby czytniki ekranu i dzielenie wyrazów działały poprawnie. */
  readLang?: string;
  altLang?: string;
  open: boolean;
  /** Pierwsze wersety, dopóki czytelnik nie odsłonił żadnego tłumaczenia: cichy znacznik „tu jest drugi przekład". */
  hint?: boolean;
  favorite: boolean;
  highlight?: HighlightColor;
  note?: string;
  onToggle: () => void;
  onToggleFavorite: () => void;
  /** Tryb nauki (tylko zalogowani): odpowiedź po odsłonięciu tłumaczenia i stan fiszki. */
  learn?: { checked: boolean | undefined; inDeck: boolean };
  onCheck?: (understood: boolean) => void;
  onToggleCard?: () => void;
  onHighlight: (color: HighlightColor | null) => void;
  /** Pusty tekst usuwa notatkę. */
  onSaveNote: (text: string) => void;
  /** Opóźnienie (s) animacji odsłonięcia/zwinięcia — „rozwiń wszystkie" puszcza falę od werseta pod okiem. */
  revealDelay?: number;
  /** Bez konta ulubione, wyróżnienia i notatki nie mają gdzie się zapisać, więc nie pokazujemy tych akcji wcale. */
  locked?: boolean;
}

/**
 * Jeden werset. Odsłanianie drugiego tłumaczenia (hover celowo nie jest mechanizmem — na dotyku
 * nie istnieje) ma dwie drogi: prawdziwy przycisk przy numerze (klawiatura, czytniki ekranu)
 * oraz kliknięcie/tap w sam tekst dla myszy i palca. Tekst pozostaje zwykłym akapitem, więc czytnik
 * ekranu czyta werset, a zaznaczanie do skopiowania nie przełącza odsłonięcia. Akcje (ulubione,
 * wyróżnienie, notatka) są rodzeństwem, a nie dziećmi, żeby nie zagnieżdżać kontrolek.
 */
export function VerseRow({
  verse,
  readLang,
  altLang,
  open,
  hint,
  favorite,
  highlight,
  note,
  onToggle,
  onToggleFavorite,
  learn,
  onCheck,
  onToggleCard,
  onHighlight,
  onSaveNote,
  revealDelay = 0,
  locked,
}: VerseRowProps) {
  const toggledByClick = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const altRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const splitRef = useRef<SplitText | null>(null);
  const delayRef = useRef(0);
  delayRef.current = revealDelay;
  const reduceMotion = useReducedMotion();
  // Blok z tłumaczeniem zostaje w DOM do końca animacji zwijania, dopiero potem znika.
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);
  const altVisible = open || mounted;

  // „Zapalenie lampy": wysokość rozpycha kolejne wersety (zamiast skoku), linie tekstu wjeżdżają z maski,
  // bursztynowa kreska rysuje się od góry, a wiersz na chwilę ciepło się rozjaśnia.
  useGSAP(
    () => {
      const wrap = altRef.current;
      tlRef.current?.kill();
      splitRef.current?.revert(); // przerwana animacja nie może zostawić pociętego tekstu
      splitRef.current = null;
      if (!wrap) return;
      const snap = reduceMotion || !nearViewport(rowRef.current);
      if (!open) {
        if (!mounted) return;
        if (snap) return setMounted(false);
        const text = wrap.querySelector<HTMLElement>("[data-alt-text]");
        tlRef.current = gsap
          .timeline({ delay: delayRef.current, onComplete: () => setMounted(false) })
          .set(wrap, { overflow: "hidden" })
          .to(text, { opacity: 0, duration: 0.14, ease: "power1.out" })
          .to(wrap, { height: 0, duration: 0.3, ease: "power2.inOut" }, 0.04);
        return;
      }
      if (snap) return;
      const text = wrap.querySelector<HTMLElement>("[data-alt-text]");
      const rule = wrap.querySelector<HTMLElement>("[data-alt-rule]");
      const glow = rowRef.current?.querySelector<HTMLElement>("[data-alt-glow]");
      if (!text) return;
      const split = SplitText.create(text, { type: "lines", mask: "lines", linesClass: "alt-line" });
      splitRef.current = split;
      const tl = gsap.timeline({
        delay: delayRef.current,
        onComplete: () => {
          split.revert(); // po animacji tekst wraca do zwykłego akapitu (zawijanie, kopiowanie, zmiana rozmiaru)
          gsap.set(wrap, { clearProps: "height,overflow" });
        },
      });
      tl.set(wrap, { overflow: "hidden" })
        .fromTo(wrap, { height: 0 }, { height: "auto", duration: 0.4, ease: "power3.out" }, 0)
        .from(split.lines, { yPercent: 115, duration: 0.6, ease: "power3.out", stagger: 0.07 }, 0.06);
      if (rule) tl.fromTo(rule, { scaleY: 0 }, { scaleY: 1, duration: 0.5, ease: "power2.out" }, 0.08);
      if (glow) tl.fromTo(glow, { opacity: 1 }, { opacity: 0, duration: 1.2, ease: "power2.out" }, 0.05);
      tlRef.current = tl;
    },
    // `mounted` celowo poza zależnościami: jego zmiana po otwarciu nie może restartować animacji.
    { dependencies: [open, reduceMotion], scope: rowRef },
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  // Anulowana edycja (Esc / „Anuluj") zostawia szkic, żeby nie tracić wpisanego tekstu.
  const [unsaved, setUnsaved] = useState(false);

  const startEditing = () => {
    setMenuOpen(false);
    if (!unsaved) setDraft(note ?? "");
    setEditing(true);
  };
  const finishEditing = () => {
    if (draft.trim() !== (note ?? "")) onSaveNote(draft);
    setUnsaved(false);
    setEditing(false);
  };
  const cancelEditing = () => {
    setUnsaved(draft.trim() !== (note ?? ""));
    setEditing(false);
  };

  // Akcje (ulubione, wyróżnienie, notatka) pokazujemy przy odsłoniętym wersecie albo gdy coś już zapisano;
  // na desktopie także po najechaniu. Dzięki temu telefon nie płaci dwoma przyciskami za każdy werset,
  // a czytnik ekranu i klawiatura nie mają trzech punktów zatrzymania na werset.
  const showActions = !locked && (open || favorite || !!highlight || !!note || menuOpen || editing);
  const altId = `verse-alt-${verse.v}`;
  const status = [
    highlight ? `wyróżniony (${COLOR_LABEL[highlight]})` : null,
    favorite ? "w ulubionych" : null,
    note ? "z notatką" : null,
  ].filter(Boolean);

  return (
    <div
      ref={rowRef}
      data-verse-row
      className={cn(
        "group relative grid grid-cols-[1.75rem_1fr_auto] items-start gap-x-2 rounded-lg px-1.5 py-2 transition-colors sm:grid-cols-[2.25rem_1fr_auto] sm:gap-x-3 sm:px-2.5",
        highlight ? `hl-${highlight}` : open && "bg-accent/40",
        hint && !open && "reveal-nudge",
        !highlight && "hover:bg-accent/50",
      )}
      data-testid={`verse-${verse.v}`}
    >
      {altVisible && (
        <span
          data-alt-glow
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-lg bg-primary/10 opacity-0"
        />
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={open ? altId : undefined}
        aria-label={`Werset ${verse.v}${status.length ? `, ${status.join(", ")}` : ""}: ${open ? "ukryj" : "pokaż"} tłumaczenie`}
        className={cn(
          "relative flex select-none flex-col items-end gap-1 justify-self-end rounded-md px-1 pt-[0.35rem] text-right font-sans text-xs tabular-nums text-verse-number sm:text-sm",
          // Pole dotyku 44 px bez zmiany układu: rozszerza je niewidoczny pseudo-element.
          "after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']",
          "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        )}
        data-testid={`button-toggle-verse-${verse.v}`}
      >
        {verse.v}
        {hint && !open && <Languages className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
      </button>

      {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: skrót dla myszy i dotyku — pełnoprawną kontrolką z klawiaturą jest przycisk przy numerze */}
      <div
        className="min-w-0 cursor-pointer"
        onClick={(e) => {
          // Dwuklik/trzykrok służy do zaznaczania słowa/wersetu, nie do odsłaniania: pierwszy klik już
          // przełączył, więc drugi go cofa (bez opóźniania zwykłego kliknięcia).
          if (e.detail === 2) {
            if (toggledByClick.current) onToggle();
            toggledByClick.current = false;
            return;
          }
          if (e.detail > 2 || (window.getSelection()?.toString() ?? "") !== "") return;
          if ((e.target as HTMLElement).closest("a, button")) return;
          toggledByClick.current = true;
          onToggle();
        }}
      >
        <p className="verse-en" lang={readLang}>{verse.text}</p>

        {altVisible && (
          <div ref={altRef} className="relative pt-2">
            <span
              data-alt-rule
              aria-hidden="true"
              className="absolute bottom-0 left-0 top-2 w-0.5 origin-top rounded-full bg-primary/40"
            />
            <p id={altId} data-alt-text lang={altLang} className="verse-pl pl-3" data-testid={`verse-pl-${verse.v}`}>
              {verse.alt ?? (
                <span className="text-xs not-italic text-muted-foreground">
                  Brak odpowiednika w numeracji tego tłumaczenia — zajrzyj do sąsiednich wersetów.
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex items-center max-sm:col-start-2 max-sm:row-start-2 max-sm:-ml-3 max-sm:mt-1",
          !showActions && "max-sm:hidden sm:invisible sm:group-hover:visible",
          locked && "hidden",
        )}
      >
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={favorite ? `Usuń werset ${verse.v} z ulubionych` : `Dodaj werset ${verse.v} do ulubionych`}
          aria-pressed={favorite}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-md transition-all sm:mt-0.5 sm:h-8 sm:w-8",
            "hover:bg-background focus-visible:ring-2 focus-visible:ring-ring",
            favorite ? "text-primary" : "text-muted-foreground",
          )}
          data-testid={`button-favorite-${verse.v}`}
        >
          <Star className={cn("h-4 w-4", favorite && "fill-current")} />
        </button>

        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Więcej akcji dla wersetu ${verse.v}`}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-all sm:mt-0.5 sm:h-8 sm:w-8",
                "hover:bg-background focus-visible:ring-2 focus-visible:ring-ring",
              )}
              data-testid={`button-verse-menu-${verse.v}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-56 space-y-2 p-2"
            // Przy przejściu do edytora notatki Radix oddałby fokus przyciskowi „…" i zabrał go polu tekstowemu.
            onCloseAutoFocus={(e) => {
              if (editing) e.preventDefault();
            }}
          >
            <p className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
              <Highlighter className="h-3.5 w-3.5" /> Wyróżnij werset
            </p>
            <div className="flex flex-wrap items-center gap-2 px-1">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Wyróżnij na ${COLOR_LABEL[c]}`}
                  aria-pressed={highlight === c}
                  onClick={() => {
                    onHighlight(highlight === c ? null : c);
                    setMenuOpen(false);
                  }}
                  className={cn(
                    "h-10 w-10 rounded-full ring-offset-2 ring-offset-popover focus-visible:ring-2 focus-visible:ring-ring",
                    SWATCH[c],
                    highlight === c && "ring-2 ring-foreground",
                  )}
                />
              ))}
              {highlight && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    onHighlight(null);
                    setMenuOpen(false);
                  }}
                >
                  Zdejmij
                </Button>
              )}
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={startEditing}>
              <StickyNote className="mr-2 h-4 w-4" /> {note ? "Edytuj notatkę" : "Dodaj notatkę"}
            </Button>
            {onToggleCard && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  onToggleCard();
                  setMenuOpen(false);
                }}
              >
                <Layers className="mr-2 h-4 w-4" /> {learn?.inDeck ? "Usuń z powtórek" : "Dodaj do powtórek"}
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {open && learn && verse.alt && onCheck && (
        <fieldset
          className="col-start-2 m-0 mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-0 p-0 text-xs text-muted-foreground"
          aria-label={`Czy rozumiesz werset ${verse.v} bez tłumaczenia?`}
        >
          <span>Zrozumiano bez tłumaczenia?</span>
          {[
            { value: true, label: "Tak" },
            { value: false, label: "Trzeba było sprawdzić" },
          ].map((o) => (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={learn.checked === o.value}
              onClick={() => onCheck(o.value)}
              className={cn(
                "min-h-9 rounded-full border px-3 py-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                learn.checked === o.value
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border hover:border-primary/40 hover:text-foreground",
              )}
              data-testid={`button-check-${o.value ? "yes" : "no"}-${verse.v}`}
            >
              {o.label}
            </button>
          ))}
        </fieldset>
      )}

      {(note || editing) && (
        <div className="col-start-2 mt-2">
          {editing ? (
            <div className="space-y-2">
              <Textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelEditing();
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) finishEditing();
                }}
                maxLength={4000}
                rows={3}
                placeholder="Twoja notatka do tego wersetu…"
                aria-label={`Notatka do wersetu ${verse.v}`}
                className="text-sm"
                data-testid={`input-note-${verse.v}`}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={finishEditing} data-testid={`button-save-note-${verse.v}`}>
                  Zapisz
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEditing}>
                  Anuluj
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-background/60 px-3 py-2">
              <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">{note}</p>
              <button
                type="button"
                onClick={startEditing}
                aria-label={`Edytuj notatkę do wersetu ${verse.v}`}
                className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
