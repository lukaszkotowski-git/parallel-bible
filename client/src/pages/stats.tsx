import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Flame, Trophy } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchStats, qk, type StatsDto } from "@/lib/api";
import { chapterHref, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BOOKS } from "@shared/books";
import { dayKey } from "@shared/plans";

function StatTile({ icon, label, value, hint }: { icon?: React.ReactNode; label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-4 shadow-xs">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums leading-none">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const WEEKS = 26;
/** 0 = brak, 1–3 = rosnąca aktywność. */
const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3);
const LEVEL_CLASS = ["bg-muted", "bg-read-marker/30", "bg-read-marker/60", "bg-read-marker"];

/** Kalendarz aktywności (26 tygodni × 7 dni), kolumny = tygodnie od poniedziałku. */
function ActivityCalendar({ daily, tz }: { daily: StatsDto["daily"]; tz: string }) {
  const weeks = useMemo(() => {
    const today = new Date();
    const todayKey = dayKey(today, tz);
    // dzień tygodnia „dziś" w strefie użytkownika (pn = 0)
    const dow = (new Date(`${todayKey}T00:00:00Z`).getUTCDay() + 6) % 7;
    const cols: { key: string; n: number; future: boolean }[][] = [];
    for (let w = WEEKS - 1; w >= 0; w--) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const offset = w * 7 + (dow - d); // dni wstecz od dziś
        const date = new Date(`${todayKey}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() - offset);
        const key = date.toISOString().slice(0, 10);
        col.push({ key, n: daily[key] ?? 0, future: offset < 0 });
      }
      cols.push(col);
    }
    return cols;
  }, [daily, tz]);

  return (
    <div className="overflow-x-auto pb-1" role="img" aria-label="Kalendarz aktywności z ostatnich 26 tygodni">
      <div className="flex w-max gap-1">
        {weeks.map((col, i) => (
          <div key={i} className="flex flex-col gap-1">
            {col.map((c) => (
              <div
                key={c.key}
                title={c.future ? undefined : `${c.key}: ${c.n} ${plural(c.n, "rozdział", "rozdziały", "rozdziałów")}`}
                className={cn("h-3.5 w-3.5 rounded-sm", c.future ? "opacity-0" : LEVEL_CLASS[level(c.n)])}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BookMap({ byBook }: { byBook: StatsDto["byBook"] }) {
  return (
    <div className="space-y-2">
      {BOOKS.map((b) => {
        const read = new Set(byBook[b.id] ?? []);
        return (
          <div key={b.id} className="flex items-center gap-3">
            <Link
              href={`/ksiega/${b.id}`}
              className="w-24 shrink-0 truncate text-xs text-muted-foreground hover:text-foreground sm:w-28"
            >
              {b.shortPl}
            </Link>
            <div
              className="flex min-w-0 flex-1 flex-wrap gap-[3px]"
              role="img"
              aria-label={`${b.namePl}: przeczytane ${read.size} z ${b.chapterCount}`}
            >
              {Array.from({ length: b.chapterCount }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={chapterHref(b.id, n)}
                  title={`${b.shortPl} ${n}${read.has(n) ? " — przeczytany" : ""}`}
                  aria-label={`${b.shortPl} ${n}${read.has(n) ? ", przeczytany" : ""}`}
                  className={cn(
                    "h-2.5 w-2.5 rounded-[2px] focus-visible:ring-2 focus-visible:ring-ring",
                    read.has(n) ? "bg-read-marker" : "bg-muted hover:bg-muted-foreground/40",
                  )}
                />
              ))}
            </div>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {read.size}/{b.chapterCount}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatsContent() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: qk.stats, queryFn: fetchStats, retry: 1 });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (isLoading)
    return (
      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  if (isError || !data)
    return (
      <div className="mt-10 text-center" role="alert">
        <p className="text-sm text-muted-foreground">Nie udało się wczytać statystyk.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Spróbuj ponownie</Button>
      </div>
    );

  const atRisk = data.currentStreak > 0 && !data.readToday;
  return (
    <div className="mt-6 space-y-8">
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          icon={<Flame className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Seria"
          value={data.currentStreak}
          hint={atRisk ? "Przeczytaj coś dziś, żeby ją utrzymać" : plural(data.currentStreak, "dzień z rzędu", "dni z rzędu", "dni z rzędu")}
        />
        <StatTile icon={<Trophy className="h-3.5 w-3.5" aria-hidden="true" />} label="Rekord" value={data.longestStreak} hint="najdłuższa seria (dni)" />
        <StatTile label="Rozdziały" value={data.totalRead} hint="oznaczone jako przeczytane" />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ostatnie pół roku</h2>
        <ActivityCalendar daily={data.daily} tz={tz} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mapa Biblii</h2>
        <BookMap byBook={data.byBook} />
      </section>
    </div>
  );
}

export default function StatsPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <AppHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="font-display text-xl font-bold leading-tight">Statystyki czytania</h1>
        <RequireAuth what="Statystyki">
          <StatsContent />
        </RequireAuth>
      </main>
    </div>
  );
}
