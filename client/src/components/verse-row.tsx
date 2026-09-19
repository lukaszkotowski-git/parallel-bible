import { useState } from "react";
import { Highlighter, Layers, MoreHorizontal, Pencil, StickyNote, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { HIGHLIGHT_COLORS, type HighlightColor, type ParallelVerse } from "@shared/schema";

const COLOR_LABEL: Record<HighlightColor, string> = {
  yellow: "żółty",
  green: "zielony",
  blue: "niebieski",
  pink: "różowy",
};
const SWATCH: Record<HighlightColor, string> = {
  yellow: "bg-yellow-400",
  green: "bg-green-500",
  blue: "bg-blue-500",
  pink: "bg-pink-500",
};

interface VerseRowProps {
  verse: ParallelVerse;
  /** Kody języków (ISO) — do atrybutu `lang`, żeby czytniki ekranu i dzielenie wyrazów działały poprawnie. */
  readLang?: string;
  altLang?: string;
  open: boolean;
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
}

/**
 * Jeden werset. Kliknięcie/tap w tekst odsłania drugie tłumaczenie (hover celowo nie jest
 * mechanizmem — na dotyku nie istnieje). Akcje (ulubione, wyróżnienie, notatka) są
 * rodzeństwem obszaru klikalnego, a nie jego dziećmi, żeby nie zagnieżdżać kontrolek.
 */
export function VerseRow({
  verse,
  readLang,
  altLang,
  open,
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
}: VerseRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEditing = () => {
    setDraft(note ?? "");
    setEditing(true);
    setMenuOpen(false);
  };
  const finishEditing = () => {
    if (draft.trim() !== (note ?? "")) onSaveNote(draft);
    setEditing(false);
  };

  const status = [
    highlight ? `wyróżniony (${COLOR_LABEL[highlight]})` : null,
    favorite ? "w ulubionych" : null,
    note ? "z notatką" : null,
  ].filter(Boolean);

  return (
    <div
      className={cn(
        "group grid grid-cols-[1.75rem_1fr_auto] items-start gap-x-2 rounded-lg px-1.5 py-2 transition-colors sm:grid-cols-[2.25rem_1fr_auto] sm:gap-x-3 sm:px-2.5",
        highlight ? `hl-${highlight}` : open && "bg-accent/40",
        !highlight && "hover:bg-accent/50",
      )}
      data-testid={`verse-${verse.v}`}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: w środku są <p> — <button> dopuszcza tylko phrasing content */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`Werset ${verse.v}${status.length ? `, ${status.join(", ")}` : ""}. ${open ? "Ukryj" : "Pokaż"} tłumaczenie`}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="col-span-2 grid cursor-pointer grid-cols-subgrid items-start rounded-md focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className="select-none pt-[0.35rem] text-right font-sans text-xs tabular-nums text-verse-number sm:text-sm"
          aria-hidden="true"
        >
          {verse.v}
        </span>

        <div className="min-w-0">
          <p className="verse-en" lang={readLang}>{verse.text}</p>

          {open && (
            <p
              lang={altLang}
              className="verse-pl mt-2 animate-verse-reveal border-l-2 border-primary/40 pl-3"
              data-testid={`verse-pl-${verse.v}`}
            >
              {verse.alt ?? (
                <span className="text-xs not-italic text-muted-foreground">
                  Brak odpowiednika w numeracji tego tłumaczenia — zajrzyj do sąsiednich wersetów.
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={favorite ? `Usuń werset ${verse.v} z ulubionych` : `Dodaj werset ${verse.v} do ulubionych`}
          aria-pressed={favorite}
          className={cn(
            "mt-0.5 flex h-8 w-8 items-center justify-center rounded-md transition-all",
            "hover:bg-background focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
            favorite
              ? "text-primary opacity-100"
              : "text-muted-foreground opacity-60 sm:opacity-0 sm:group-hover:opacity-70 sm:group-focus-within:opacity-70",
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
                "mt-0.5 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-all",
                "hover:bg-background focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
                highlight || note ? "opacity-100" : "opacity-60 sm:opacity-0 sm:group-hover:opacity-70 sm:group-focus-within:opacity-70",
              )}
              data-testid={`button-verse-menu-${verse.v}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 space-y-2 p-2">
            <p className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
              <Highlighter className="h-3.5 w-3.5" /> Wyróżnij werset
            </p>
            <div className="flex items-center gap-2 px-1">
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
                    "h-7 w-7 rounded-full ring-offset-2 ring-offset-popover focus-visible:ring-2 focus-visible:ring-ring",
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
          <span>Zrozumiałeś bez tłumaczenia?</span>
          {[
            { value: true, label: "Tak" },
            { value: false, label: "Musiałem sprawdzić" },
          ].map((o) => (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={learn.checked === o.value}
              onClick={() => onCheck(o.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring",
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
                  if (e.key === "Escape") setEditing(false);
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
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
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
