import { useMutation, useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { fetchLeaderboard, qk, setLeaderboardOptIn } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LeaderboardBoard, LeaderboardRow } from "@shared/gamification";

function Row({ row, unit }: { row: LeaderboardRow; unit: (n: number) => string }) {
  return (
    <li
      className={cn("flex items-center gap-3 px-4 py-3", row.isMe && "bg-primary/5")}
      aria-current={row.isMe ? "true" : undefined}
      data-testid={`leaderboard-row-${row.rank}`}
    >
      <span className={cn("w-7 shrink-0 text-center font-display text-lg font-bold tabular-nums", row.rank > 3 && "text-base font-semibold text-muted-foreground")}>
        {row.rank}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {row.name}
        {row.isMe && <span className="font-normal text-muted-foreground"> (Ty)</span>}
      </span>
      <span className="shrink-0 text-sm tabular-nums">
        <strong className="font-semibold">{row.value.toLocaleString("pl-PL")}</strong>{" "}
        <span className="text-muted-foreground">{unit(row.value)}</span>
      </span>
    </li>
  );
}

function Board({ board, unit, empty }: { board: LeaderboardBoard; unit: (n: number) => string; empty: string }) {
  if (board.top.length === 0) {
    return <p className="rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card shadow-xs">
      <ol className="divide-y divide-border">
        {board.top.map((r) => <Row key={`${r.rank}-${r.name}`} row={r} unit={unit} />)}
      </ol>
      {board.me && (
        <div className="border-t border-dashed border-border">
          <p className="px-4 pt-2 text-xs text-muted-foreground">Twoja pozycja</p>
          <ol><Row row={board.me} unit={unit} /></ol>
        </div>
      )}
    </div>
  );
}

const chapters = (n: number) => plural(n, "rozdział", "rozdziały", "rozdziałów");
const days = (n: number) => plural(n, "dzień", "dni", "dni");

function LeaderboardContent() {
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: qk.leaderboard, queryFn: fetchLeaderboard, retry: 1, staleTime: 0 });
  const opt = useMutation({
    mutationFn: setLeaderboardOptIn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.leaderboard }),
    onError: () => toast({ title: "Nie udało się zapisać", variant: "destructive", duration: 4000 }),
  });

  if (isLoading) return <Skeleton className="mt-6 h-72 rounded-xl" />;
  if (isError || !data)
    return (
      <div className="mt-10 text-center" role="alert">
        <p className="text-sm text-muted-foreground">Nie udało się wczytać rankingu.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Spróbuj ponownie</Button>
      </div>
    );

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-start gap-4 rounded-xl border border-card-border bg-card p-4 shadow-xs">
        <div className="min-w-0 flex-1">
          <label htmlFor="opt-in" className="text-sm font-medium">Pokazuj mnie w rankingu</label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.optedIn
              ? "Inni widzą Twoje imię i wynik. Możesz się wycofać w każdej chwili."
              : "Domyślnie nikt Cię nie widzi. Po włączeniu pokażemy tylko Twoje imię i wynik."}
          </p>
        </div>
        <Switch id="opt-in" checked={data.optedIn} disabled={opt.isPending} onCheckedChange={(v) => opt.mutate(v)} data-testid="switch-leaderboard" />
      </div>

      <Tabs defaultValue="chapters">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chapters">Ogółem</TabsTrigger>
          <TabsTrigger value="today">Dziś</TabsTrigger>
          <TabsTrigger value="streak">Seria</TabsTrigger>
        </TabsList>
        <TabsContent value="chapters" className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground">Przeczytane rozdziały w ogóle</p>
          <Board board={data.chapters} unit={chapters} empty="Nikt jeszcze nie dołączył do rankingu." />
        </TabsContent>
        <TabsContent value="today" className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground">Rozdziały przeczytane dzisiaj</p>
          <Board board={data.today} unit={chapters} empty="Dziś nikt jeszcze nic nie przeczytał." />
        </TabsContent>
        <TabsContent value="streak" className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground">Najdłuższa seria dni czytania</p>
          <Board board={data.streak} unit={days} empty="Nikt jeszcze nie ma serii." />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        W rankingu liczy się tylko czytanie z uwagą (rozdział z sensownym czasem na stronie) — samo odhaczanie
        i zbiorcze oznaczanie ksiąg nie dodaje punktów. Uczestniczy {data.participants}{" "}
        {plural(data.participants, "osoba", "osoby", "osób")}.
      </p>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <AppHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="flex items-center gap-2 font-display text-xl font-bold leading-tight">
          <Trophy className="h-5 w-5 text-primary" aria-hidden="true" /> Ranking czytelników
        </h1>
        <RequireAuth what="Ranking">
          <LeaderboardContent />
        </RequireAuth>
      </main>
    </div>
  );
}
