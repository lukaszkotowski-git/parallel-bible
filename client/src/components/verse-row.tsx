import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParallelVerse } from "@shared/schema";

interface VerseRowProps {
  verse: ParallelVerse;
  open: boolean;
  favorite: boolean;
  onToggle: () => void;
  onToggleFavorite: () => void;
}

/**
 * Jeden werset. Kliknięcie/tap w dowolne miejsce wiersza odsłania przekład polski
 * (hover celowo nie jest mechanizmem — na dotyku nie istnieje).
 */
export function VerseRow({ verse, open, favorite, onToggle, onToggleFavorite }: VerseRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={`Werset ${verse.v}. ${open ? "Ukryj" : "Pokaż"} przekład polski`}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "group grid cursor-pointer grid-cols-[1.75rem_1fr_2rem] items-start gap-x-2 rounded-lg px-1.5 py-2 transition-colors sm:grid-cols-[2.25rem_1fr_2.25rem] sm:gap-x-3 sm:px-2.5",
        "hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring",
        open && "bg-accent/40",
      )}
      data-testid={`verse-${verse.v}`}
    >
      <span
        className="select-none pt-[0.35rem] text-right font-sans text-xs tabular-nums text-verse-number sm:text-sm"
        aria-hidden="true"
      >
        {verse.v}
      </span>

      <div className="min-w-0">
        <p className="verse-en">{verse.en}</p>

        {open && (
          <p
            className="verse-pl mt-2 animate-verse-reveal border-l-2 border-primary/40 pl-3"
            data-testid={`verse-pl-${verse.v}`}
          >
            {verse.pl ?? (
              <span className="text-xs not-italic text-muted-foreground">
                Brak odpowiednika w numeracji Biblii Gdańskiej — zajrzyj do sąsiednich wersetów.
              </span>
            )}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
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
    </div>
  );
}
