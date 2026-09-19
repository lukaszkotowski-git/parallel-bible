import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Layers, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  fetchLearn,
  invalidateLearn,
  qk,
  removeLearnCard,
  reviewLearnCard,
  setLearnMastered,
  type Rating,
} from "@/lib/api";
import { chapterHref, chapterLabel, plural } from "@/lib/format";
import { announceReward } from "@/lib/rewards";
import { cn } from "@/lib/utils";
import type { LearnCardDto } from "@shared/gamification";

const RATING_BUTTONS: { rating: Rating; label: string; hint: string }[] = [
  { rating: "again", label: "Nie pamiętałem", hint: "wróci za chwilę" },
  { rating: "hard", label: "Trudne", hint: "wróci wcześniej" },
  { rating: "good", label: "Dobrze", hint: "wróci później" },
  { rating: "easy", label: "Łatwo", hint: "wróci dużo później" },
];

/** Jedna sesja powtórek: EN na awersie, po „Pokaż polski" ocena. „Nie pamiętałem" wraca na koniec kolejki. */
function ReviewSession({ initial, onFinish }: { initial: LearnCardDto[]; onFinish: () => void }) {
  const { toast } = useToast();
  const [queue, setQueue] = useState(initial);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const card = queue[0];

  if (!card) {
    return (
      <div className="mt-6 rounded-xl border border-card-border bg-card p-8 text-center" role="status">
        <CheckCircle2 className="mx-auto h-8 w-8 text-read-marker" aria-hidden="true" />
        <p className="mt-3 font-display text-lg font-bold">Powtórki na dziś zrobione</p>
        <p className="mt-1 text-sm text-muted-foreground">Wykonane: {done}. Do zobaczenia jutro.</p>
        <Button className="mt-4" variant="outline" onClick={onFinish}>Wróć do talii</Button>
      </div>
    );
  }

  const rate = async (rating: Rating) => {
    setBusy(true);
    try {
      announceReward(await reviewLearnCard({ bookId: card.bookId, chapter: card.chapter, verse: card.verse }, rating));
      setDone((d) => d + 1);
      setQueue((q) => (rating === "again" ? [...q.slice(1), card] : q.slice(1)));
      setRevealed(false);
    } catch {
      toast({ title: "Nie udało się zapisać oceny", variant: "destructive", duration: 4000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6" data-testid="review-session">
      <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
        Pozostało w kolejce: {queue.length}
      </p>
      <div className="mt-2 rounded-xl border border-card-border bg-card p-5 shadow-xs sm:p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {chapterLabel(card.bookId, card.chapter)}:{card.verse}
        </p>
        <p className="verse-en mt-2">{card.en}</p>

        {revealed ? (
          <>
            <p className="verse-pl mt-4 animate-verse-reveal border-l-2 border-primary/40 pl-3" data-testid="review-pl">
              {card.pl ?? "Brak odpowiednika w numeracji wybranego tłumaczenia."}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATING_BUTTONS.map((b) => (
                <Button key={b.rating} variant="outline" className="h-auto flex-col gap-0.5 py-2" disabled={busy} onClick={() => rate(b.rating)} data-testid={`rate-${b.rating}`}>
                  <span>{b.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">{b.hint}</span>
                </Button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted-foreground">Spróbuj przypomnieć sobie polski przekład, potem sprawdź.</p>
            <Button className="mt-3" onClick={() => setRevealed(true)} data-testid="button-reveal">
              Pokaż polski
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function LearnContent() {
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: qk.learn, queryFn: fetchLearn, retry: 1, staleTime: 0 });
  const [session, setSession] = useState<LearnCardDto[] | null>(null);

  if (isLoading) return <Skeleton className="mt-6 h-48 rounded-xl" />;
  if (isError || !data)
    return (
      <div className="mt-10 text-center" role="alert">
        <p className="text-sm text-muted-foreground">Nie udało się wczytać talii.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Spróbuj ponownie</Button>
      </div>
    );

  const { totals, cards, due } = data;

  const remove = async (c: LearnCardDto) => {
    try {
      await removeLearnCard({ bookId: c.bookId, chapter: c.chapter, verse: c.verse });
      invalidateLearn();
    } catch {
      toast({ title: "Nie udało się usunąć", variant: "destructive", duration: 4000 });
    }
  };
  const toggleMastered = async (c: LearnCardDto) => {
    try {
      announceReward(await setLearnMastered({ bookId: c.bookId, chapter: c.chapter, verse: c.verse }, !c.mastered));
      invalidateLearn();
    } catch {
      toast({ title: "Nie udało się zapisać", variant: "destructive", duration: 4000 });
    }
  };

  return (
    <>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { label: "W talii", value: totals.total },
          { label: "Na dziś", value: totals.due },
          { label: "Umiem", value: totals.mastered },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-card-border bg-card p-4 shadow-xs">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.label}</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums leading-none">{t.value}</p>
          </div>
        ))}
      </div>

      {session ? (
        <ReviewSession
          initial={session}
          onFinish={() => {
            setSession(null);
            invalidateLearn();
          }}
        />
      ) : due.length > 0 ? (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-card-border bg-card p-4">
          <p className="text-sm">
            Masz <strong className="tabular-nums">{totals.due}</strong> {plural(totals.due, "werset", "wersety", "wersetów")} do powtórki.
          </p>
          <Button onClick={() => setSession(due)} data-testid="button-start-review">Zacznij powtórki</Button>
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          {totals.total === 0
            ? "Talia jest pusta. W trakcie czytania odsłoń polski werset i wybierz „Musiałem sprawdzić” albo dodaj werset z menu „⋯” do powtórek."
            : "Na dziś nic do powtórki. Wracaj jutro."}
        </p>
      )}

      {cards.length > 0 && (
        <section className="mt-8" aria-label="Twoja talia">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Twoja talia</h2>
          <ul className="space-y-2">
            {cards.map((c) => (
              <li key={`${c.bookId}${c.chapter}${c.verse}`} className="flex items-start gap-3 rounded-lg border border-card-border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <Link href={chapterHref(c.bookId, c.chapter)} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                    {chapterLabel(c.bookId, c.chapter)}:{c.verse}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{c.en}</p>
                </div>
                <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-xs", c.mastered ? "bg-read-marker/15 text-read-marker" : "bg-muted text-muted-foreground")}>
                  {c.mastered ? "umiem" : `pudełko ${c.box}/5`}
                </span>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => toggleMastered(c)}>
                  {c.mastered ? "Jeszcze nie" : "Umiem"}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(c)} aria-label={`Usuń ${chapterLabel(c.bookId, c.chapter)}:${c.verse} z talii`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function LearnPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <AppHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="flex items-center gap-2 font-display text-xl font-bold leading-tight">
          <Layers className="h-5 w-5 text-primary" aria-hidden="true" /> Nauka wersetów
        </h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          Werset po angielsku, a Ty przypominasz sobie polski. Im lepiej pamiętasz, tym rzadziej wraca.
        </p>
        <RequireAuth what="Nauka wersetów">
          <LearnContent />
        </RequireAuth>
      </main>
    </div>
  );
}
