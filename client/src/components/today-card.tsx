import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Flame, Layers, Minus, Plus, RotateCcw, Sparkles, Target } from "lucide-react";
import { ProgressRing } from "@/components/progress-ring";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  fetchProgress,
  fetchVerseOfDay,
  invalidateLearn,
  invalidateUserState,
  qk,
  restoreStreak,
  saveGoal,
  setLearnMastered,
  addLearnCard,
} from "@/lib/api";
import { chapterHref, chapterLabel } from "@/lib/format";
import { announceReward } from "@/lib/rewards";
import { plural } from "@/lib/format";

/** Dzienny cel + poziom + seria — spokojny „stan dnia", bez rankingów i presji. */
function GoalPanel() {
  const { toast } = useToast();
  const { data: p } = useQuery({ queryKey: qk.progress, queryFn: fetchProgress });
  const goalMutation = useMutation({
    mutationFn: saveGoal,
    onSuccess: () => invalidateUserState(),
  });
  const restore = useMutation({
    mutationFn: restoreStreak,
    onSuccess: () => {
      invalidateUserState();
      toast({ title: "Seria przywrócona", description: "Wróciła — spokojnie czytaj dalej.", duration: 4000 });
    },
    onError: () => toast({ title: "Nie udało się przywrócić serii", variant: "destructive", duration: 4000 }),
  });
  const [draftGoal, setDraftGoal] = useState<number | null>(null);
  if (!p) return null;

  const { goal, level, streak } = p;
  const done = goal.todayCount >= goal.dailyChapters;
  const percent = Math.min(100, (goal.todayCount / goal.dailyChapters) * 100);
  const shownGoal = draftGoal ?? goal.dailyChapters;
  const setGoalTo = (n: number) => {
    const next = Math.min(20, Math.max(1, n));
    setDraftGoal(next);
    goalMutation.mutate(next, { onSettled: () => setDraftGoal(null) });
  };

  return (
    <div className="rounded-xl border border-card-border bg-card p-4 shadow-xs sm:p-5" data-testid="card-today">
      <div className="flex items-center gap-4">
        <ProgressRing
          percent={percent}
          size={64}
          strokeWidth={5}
          label={`Dzisiejszy cel: ${goal.todayCount} z ${goal.dailyChapters} rozdziałów`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Dzisiaj</p>
          <p className="font-display text-lg font-bold leading-tight">
            {done ? "Cel na dziś osiągnięty" : `${goal.todayCount} z ${goal.dailyChapters} ${plural(goal.dailyChapters, "rozdziału", "rozdziałów", "rozdziałów")}`}
          </p>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="mt-0.5 inline-flex items-center gap-1 rounded text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                <Target className="h-3 w-3" aria-hidden="true" /> Zmień cel dzienny
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Rozdziałów dziennie</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={shownGoal <= 1} onClick={() => setGoalTo(shownGoal - 1)} aria-label="Mniej">
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="flex-1 text-center text-lg font-semibold tabular-nums" aria-live="polite">{shownGoal}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={shownGoal >= 20} onClick={() => setGoalTo(shownGoal + 1)} aria-label="Więcej">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Zaczynaj od małego celu — regularność jest ważniejsza niż ilość.</p>
            </PopoverContent>
          </Popover>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 font-display text-2xl font-bold tabular-nums leading-none">
            <Flame className={streak.current > 0 ? "h-5 w-5 text-primary" : "h-5 w-5 text-muted-foreground"} aria-hidden="true" />
            {streak.current}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{plural(streak.current, "dzień serii", "dni serii", "dni serii")}</p>
        </div>
      </div>

      {streak.restorableDay && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-primary/10 px-3 py-2.5 text-sm" role="status">
          <span className="min-w-0 flex-1">Seria się przerwała, ale możesz ją jeszcze przywrócić (raz na 30 dni).</span>
          <Button size="sm" variant="outline" disabled={restore.isPending} onClick={() => restore.mutate(streak.restorableDay!)} data-testid="button-restore-streak">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Przywróć serię
          </Button>
        </div>
      )}

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <Link href="/odznaki" className="font-medium hover:underline" data-testid="link-level">
            Poziom {level.level} · {level.name}
          </Link>
          <span className="tabular-nums text-muted-foreground">
            {level.ceil ? `${level.xp} / ${level.ceil} pkt` : `${level.xp} pkt`}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Postęp do następnego poziomu" aria-valuenow={Math.round(level.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${level.progress * 100}%` }} />
        </div>
        {!streak.restDayAvailable && streak.current > 0 && !streak.readToday && (
          <p className="mt-2 text-xs text-muted-foreground">Dzień oddechu w tym tygodniu już wykorzystany — dziś warto przeczytać choć rozdział.</p>
        )}
      </div>
    </div>
  );
}

/** Werset dnia z rozdziału, który użytkownik już czytał — do zapamiętania („umiem"). */
function VerseOfDayCard() {
  const { data: v } = useQuery({ queryKey: qk.verseOfDay, queryFn: fetchVerseOfDay });
  const [showPl, setShowPl] = useState(false);
  const learn = useMutation({
    mutationFn: async (kind: "card" | "mastered") => {
      const ref = { bookId: v!.bookId, chapter: v!.chapter, verse: v!.verse };
      return kind === "card" ? addLearnCard(ref) : setLearnMastered(ref, true);
    },
    onSuccess: (res) => {
      announceReward(res);
      invalidateLearn();
    },
  });
  const { data: p } = useQuery({ queryKey: qk.progress, queryFn: fetchProgress });
  if (!v) return null;
  const ref = `${chapterLabel(v.bookId, v.chapter)}:${v.verse}`;

  return (
    <div className="rounded-xl border border-card-border bg-card p-4 shadow-xs sm:p-5" data-testid="card-verse-of-day">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Werset dnia
      </p>
      <p className="verse-en mt-2">{v.en}</p>
      {showPl && v.pl && <p className="verse-pl mt-2 animate-verse-reveal border-l-2 border-primary/40 pl-3">{v.pl}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link href={chapterHref(v.bookId, v.chapter)} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {ref}
        </Link>
        {v.pl && (
          <button type="button" onClick={() => setShowPl((s) => !s)} className="rounded text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {showPl ? "Ukryj polski" : "Pokaż po polsku"}
          </button>
        )}
        <span className="flex-1" />
        {v.mastered ? (
          <span className="text-xs text-muted-foreground">✓ Umiesz ten werset</span>
        ) : (
          <>
            {!v.inDeck && (
              <Button size="sm" variant="ghost" disabled={learn.isPending} onClick={() => learn.mutate("card")}>
                <Layers className="mr-1.5 h-3.5 w-3.5" /> Do powtórek
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={learn.isPending} onClick={() => learn.mutate("mastered")} data-testid="button-mastered">
              Umiem
            </Button>
          </>
        )}
      </div>
      {p && p.learn.due > 0 && (
        <Link
          href="/nauka"
          className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm transition-colors hover-elevate"
          data-testid="link-learn-due"
        >
          <span>
            Powtórki na dziś: <strong className="tabular-nums">{p.learn.due}</strong>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}
    </div>
  );
}

export function TodayCards() {
  return (
    <>
      <GoalPanel />
      <VerseOfDayCard />
    </>
  );
}
