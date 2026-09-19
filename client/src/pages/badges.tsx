import { useQuery } from "@tanstack/react-query";
import { Flame, Lock } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { badgeIcon } from "@/lib/badge-icons";
import { fetchBadges, fetchProgress, qk } from "@/lib/api";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BADGES, CATEGORY_LABEL, LEVELS, XP, type BadgeCategory } from "@shared/gamification";

const XP_ROWS = [
  { key: "chapters", label: "Przeczytane rozdziały", hint: `${XP.chapter} pkt za rozdział` },
  { key: "books", label: "Ukończone księgi", hint: `${XP.book} pkt za księgę` },
  { key: "goalDays", label: "Dni z osiągniętym celem", hint: `${XP.goalDay} pkt za dzień` },
  { key: "notes", label: "Notatki", hint: `${XP.note} pkt za notatkę` },
  { key: "understood", label: "Werset zrozumiany po angielsku", hint: `${XP.understood} pkt za werset` },
  { key: "mastered", label: "Wersety „umiem”", hint: `${XP.mastered} pkt za werset` },
] as const;

function Overview() {
  const { data: p, isLoading } = useQuery({ queryKey: qk.progress, queryFn: fetchProgress });
  if (isLoading || !p) return <Skeleton className="mt-6 h-64 rounded-xl" />;
  const { level, streak, xp } = p;

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <section className="rounded-xl border border-card-border bg-card p-5 shadow-xs" aria-labelledby="level-h">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Poziom {level.level}</p>
        <h2 id="level-h" className="font-display text-2xl font-bold leading-tight">{level.name}</h2>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(level.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Postęp do następnego poziomu">
          <div className="h-full rounded-full bg-primary/70" style={{ width: `${level.progress * 100}%` }} />
        </div>
        <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
          {level.ceil ? `${level.xp} / ${level.ceil} pkt do poziomu „${LEVELS[level.level]!.name}”` : `${level.xp} pkt — najwyższy poziom`}
        </p>
        <dl className="mt-4 space-y-1.5 text-sm">
          {XP_ROWS.map((r) => (
            <div key={r.key} className="flex items-baseline justify-between gap-3" title={r.hint}>
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="tabular-nums">{xp.parts[r.key]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Punkty dostajesz za czytanie z uwagą — rozdział liczy się po kilkunastu sekundach spędzonych na stronie.
        </p>
      </section>

      <section className="rounded-xl border border-card-border bg-card p-5 shadow-xs" aria-labelledby="streak-h">
        <h2 id="streak-h" className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          <Flame className="h-3.5 w-3.5" aria-hidden="true" /> Seria
        </h2>
        <p className="mt-1 font-display text-4xl font-bold tabular-nums leading-none">{streak.current}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {plural(streak.current, "dzień", "dni", "dni")} z rzędu · rekord {streak.longest}
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>
            <strong className="font-medium text-foreground">Dzień oddechu:</strong> jeden opuszczony dzień w tygodniu nie przerywa serii{" "}
            {streak.restDayAvailable ? "(w tym tygodniu jeszcze go masz)." : "(w tym tygodniu już wykorzystany)."}
          </li>
          <li>
            <strong className="font-medium text-foreground">Przywrócenie:</strong> jeśli seria pęknie, masz 48 godzin, by ją odzyskać — raz na 30 dni.
          </li>
        </ul>
        {streak.restorableDay && (
          <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-sm">Możesz teraz przywrócić serię — przycisk czeka na stronie głównej.</p>
        )}
      </section>
    </div>
  );
}

function Collection() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: qk.badges, queryFn: fetchBadges, retry: 1 });
  if (isLoading) return <Skeleton className="mt-8 h-64 rounded-xl" />;
  if (isError || !data)
    return (
      <div className="mt-10 text-center" role="alert">
        <p className="text-sm text-muted-foreground">Nie udało się wczytać odznak.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Spróbuj ponownie</Button>
      </div>
    );

  const byId = new Map(data.badges.map((b) => [b.id, b]));
  const earned = data.badges.filter((b) => b.earnedAt).length;
  const categories = Object.keys(CATEGORY_LABEL) as BadgeCategory[];

  return (
    <div className="mt-10">
      <h2 className="font-display text-lg font-bold">
        Kolekcja <span className="text-sm font-normal tabular-nums text-muted-foreground">{earned} / {BADGES.length}</span>
      </h2>
      <div className="mt-4 space-y-8">
        {categories.map((cat) => (
          <section key={cat} aria-label={CATEGORY_LABEL[cat]}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{CATEGORY_LABEL[cat]}</h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {BADGES.filter((b) => b.category === cat).map((def) => {
                const st = byId.get(def.id);
                const got = !!st?.earnedAt;
                const Icon = badgeIcon(def.icon);
                const pct = st ? (st.value / st.target) * 100 : 0;
                return (
                  <li
                    key={def.id}
                    className={cn("flex gap-3 rounded-xl border p-4", got ? "border-primary/30 bg-card shadow-xs" : "border-dashed border-border bg-muted/40")}
                    data-testid={`badge-${def.id}`}
                  >
                    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", got ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                      {got ? <Icon className="h-5 w-5" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium leading-snug", !got && "text-muted-foreground")}>
                        {def.name}
                        {got && <span className="sr-only"> (zdobyta)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{def.description}</p>
                      {got ? (
                        <p className="mt-1.5 text-xs text-primary">Zdobyta {new Date(st!.earnedAt!).toLocaleDateString("pl-PL")}</p>
                      ) : (
                        def.target > 1 && (
                          <div className="mt-2">
                            <div className="h-1 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={st?.value ?? 0} aria-valuemin={0} aria-valuemax={def.target} aria-label={`Postęp: ${def.name}`}>
                              <div className="h-full rounded-full bg-primary/50" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="mt-1 text-xs tabular-nums text-muted-foreground">{st?.value ?? 0} / {def.target}</p>
                          </div>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function BadgesPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <AppHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="font-display text-xl font-bold leading-tight">Postępy i odznaki</h1>
        <RequireAuth what="Postępy i odznaki">
          <Overview />
          <Collection />
        </RequireAuth>
      </main>
    </div>
  );
}
