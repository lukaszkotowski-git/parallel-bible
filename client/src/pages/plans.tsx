import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Plus, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { createPlan, deletePlan, fetchPlans, qk, type PlanDto } from "@/lib/api";
import { chapterHref, chapterLabel, plural } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { announceReward } from "@/lib/rewards";
import { BOOKS } from "@shared/books";
import { PLAN_TEMPLATES, planChapters } from "@shared/plans";

const ChapterChip = ({ bookId, chapter, read }: { bookId: string; chapter: number; read?: boolean }) => (
  <Link
    href={chapterHref(bookId, chapter)}
    className={
      "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm transition-colors hover-elevate " +
      (read ? "border-read-marker/40 bg-read-marker/10 text-read-marker" : "border-card-border bg-card")
    }
  >
    {read && <Check className="h-3.5 w-3.5" aria-label="przeczytany" />}
    {chapterLabel(bookId, chapter)}
  </Link>
);

function PlanCard({ plan, onDelete }: { plan: PlanDto; onDelete: () => void }) {
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const percent = plan.totalChapters ? (plan.readChapters / plan.totalChapters) * 100 : 0;
  const overdue = showAllOverdue ? plan.overdue : plan.overdue.slice(0, 8);
  const done = plan.readChapters >= plan.totalChapters;

  return (
    <article className="rounded-xl border border-card-border bg-card p-4 shadow-xs sm:p-5" data-testid={`plan-${plan.id}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold leading-tight">{plan.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {done
              ? "Plan ukończony 🎉"
              : plan.finished
                ? `Termin minął (${plan.days} dni) — dokończ zaległości`
                : `Dzień ${plan.currentDay} z ${plan.days}`}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onDelete} aria-label={`Usuń plan ${plan.name}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Progress
        value={percent}
        className="mt-3 h-2"
        aria-label={`Postęp planu: ${plan.readChapters} z ${plan.totalChapters} rozdziałów`}
      />
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        {plan.readChapters} / {plan.totalChapters} rozdziałów
      </p>

      {plan.today && plan.today.chapters.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Na dziś</h3>
          <div className="flex flex-wrap gap-2">
            {plan.today.chapters.map((c) => (
              <ChapterChip key={`${c.bookId}${c.chapter}`} {...c} />
            ))}
          </div>
        </div>
      )}

      {plan.overdue.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
            Zaległości: {plan.overdue.length} {plural(plan.overdue.length, "rozdział", "rozdziały", "rozdziałów")}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {overdue.map((c) => (
              <ChapterChip key={`${c.bookId}${c.chapter}`} {...c} />
            ))}
          </div>
          {plan.overdue.length > 8 && (
            <button
              type="button"
              className="mt-2 text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setShowAllOverdue((v) => !v)}
            >
              {showAllOverdue ? "Pokaż mniej" : `Pokaż wszystkie (${plan.overdue.length})`}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function NewPlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const [from, setFrom] = useState(BOOKS[0]!.id);
  const [to, setTo] = useState(BOOKS[BOOKS.length - 1]!.id);
  const [days, setDays] = useState("90");
  const [name, setName] = useState("");

  const customBooks = useMemo(() => {
    const a = BOOKS.findIndex((b) => b.id === from);
    const b = BOOKS.findIndex((b) => b.id === to);
    return a <= b ? BOOKS.slice(a, b + 1).map((x) => x.id) : [];
  }, [from, to]);
  const customTotal = planChapters(customBooks).length;
  const daysNum = Number(days);
  const customValid = customBooks.length > 0 && Number.isInteger(daysNum) && daysNum >= 1 && daysNum <= customTotal;

  const create = useMutation({
    mutationFn: createPlan,
    onSuccess: (reward) => {
      announceReward(reward);
      queryClientInvalidate();
      onOpenChange(false);
      toast({ title: "Plan utworzony", duration: 3000 });
    },
    onError: () => toast({ title: "Nie udało się utworzyć planu", variant: "destructive", duration: 4000 }),
  });

  const select = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nowy plan czytania</DialogTitle>
          <DialogDescription>Plan liczy postęp z rozdziałów, które oznaczasz jako przeczytane.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="template">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="template">Gotowe plany</TabsTrigger>
            <TabsTrigger value="custom">Własny plan</TabsTrigger>
          </TabsList>
          <TabsContent value="template" className="mt-3 space-y-2">
            {PLAN_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={create.isPending}
                onClick={() => create.mutate({ name: t.name, books: t.books, days: t.days })}
                className="w-full rounded-lg border border-card-border bg-card p-3 text-left transition-colors hover-elevate focus-visible:ring-2 focus-visible:ring-ring"
                data-testid={`template-${t.id}`}
              >
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="block text-xs text-muted-foreground">{t.description}</span>
              </button>
            ))}
          </TabsContent>
          <TabsContent value="custom" className="mt-3 space-y-3">
            <div>
              <Label htmlFor="plan-name">Nazwa (opcjonalnie)</Label>
              <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="plan-from">Od księgi</Label>
                <select id="plan-from" value={from} onChange={(e) => setFrom(e.target.value)} className={select + " mt-1"}>
                  {BOOKS.map((b) => <option key={b.id} value={b.id}>{b.shortPl}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="plan-to">Do księgi</Label>
                <select id="plan-to" value={to} onChange={(e) => setTo(e.target.value)} className={select + " mt-1"}>
                  {BOOKS.map((b) => <option key={b.id} value={b.id}>{b.shortPl}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="plan-days">Liczba dni</Label>
              <Input id="plan-days" type="number" inputMode="numeric" min={1} max={customTotal || undefined} value={days} onChange={(e) => setDays(e.target.value)} className="mt-1" />
            </div>
            <p className="text-xs text-muted-foreground" role="status">
              {customBooks.length === 0
                ? "Księga początkowa musi być przed końcową."
                : customValid
                  ? `${customTotal} rozdziałów, ok. ${(customTotal / daysNum).toFixed(1)} dziennie.`
                  : `Liczba dni musi mieścić się w zakresie 1–${customTotal}.`}
            </p>
            <Button
              className="w-full"
              disabled={!customValid || create.isPending}
              onClick={() =>
                create.mutate({
                  name: name.trim() || `Własny plan: ${BOOKS.find((b) => b.id === from)!.shortPl}–${BOOKS.find((b) => b.id === to)!.shortPl}`,
                  books: customBooks,
                  days: daysNum,
                })
              }
            >
              Utwórz plan
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

const queryClientInvalidate = () => queryClient.invalidateQueries({ queryKey: qk.plans });

export default function PlansPage() {
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  return (
    <div className="relative z-10 min-h-screen">
      <AppHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-xl font-bold leading-tight">Plany czytania</h1>
          <Button size="sm" onClick={() => setCreating(true)} data-testid="button-new-plan">
            <Plus className="mr-1.5 h-4 w-4" /> Nowy plan
          </Button>
        </div>
        <RequireAuth what="Plany czytania">
          <PlansList onError={() => toast({ title: "Nie udało się usunąć planu", variant: "destructive" })} />
        </RequireAuth>
        <NewPlanDialog open={creating} onOpenChange={setCreating} />
      </main>
    </div>
  );
}

function PlansList({ onError }: { onError: () => void }) {
  const { data: plans, isLoading, isError, refetch } = useQuery({ queryKey: qk.plans, queryFn: fetchPlans, retry: 1 });
  const remove = useMutation({
    mutationFn: deletePlan,
    onSuccess: queryClientInvalidate,
    onError,
  });

  if (isLoading) return <Skeleton className="mt-6 h-48 w-full rounded-xl" />;
  if (isError)
    return (
      <div className="mt-10 text-center" role="alert">
        <p className="text-sm text-muted-foreground">Nie udało się wczytać planów.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Spróbuj ponownie</Button>
      </div>
    );
  if (!plans?.length)
    return (
      <p className="mt-10 text-center text-sm text-muted-foreground">
        Nie masz jeszcze planu. Wybierz gotowy albo ułóż własny przyciskiem „Nowy plan".
      </p>
    );
  return (
    <div className="mt-6 space-y-4">
      {plans.map((p) => (
        <PlanCard
          key={p.id}
          plan={p}
          onDelete={() => {
            if (window.confirm(`Usunąć plan „${p.name}"? Twój postęp czytania zostanie zachowany.`)) remove.mutate(p.id);
          }}
        />
      ))}
    </div>
  );
}
