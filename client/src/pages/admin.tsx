import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BadgeCheck, ChevronLeft, ChevronRight, MoreHorizontal, Search, ShieldCheck } from "lucide-react";
import { AppHeader, useAuthed, useUserState } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  deleteAdminUser,
  fetchAdminUsers,
  patchAdminUser,
  qk,
  revokeUserSessions,
  type AdminUsersDto,
} from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Row = AdminUsersDto["users"][number];

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" }) : "—";

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-4 shadow-xs">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums leading-none">{value}</p>
    </div>
  );
}

function UserRow({ user, isSelf, onChanged }: { user: Row; isSelf: boolean; onChanged: () => void }) {
  const { toast } = useToast();
  const run = useMutation({
    mutationFn: (fn: () => Promise<void>) => fn(),
    onSuccess: () => onChanged(),
    // Serwer zwraca czytelne komunikaty ("To ostatni administrator") — pokazujemy je wprost.
    onError: (err: Error) =>
      toast({ title: "Nie udało się", description: err.message.replace(/^\d+:\s*/, "").replace(/^\{"message":"(.*)"\}$/, "$1"), variant: "destructive", duration: 5000 }),
  });
  const isAdmin = user.role === "admin";

  return (
    <li className="flex items-start gap-3 rounded-xl border border-card-border bg-card p-4" data-testid={`admin-user-${user.id}`}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-medium">{user.name}</span>
          {isAdmin && (
            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" /> admin
            </span>
          )}
          {isSelf && <span className="text-xs text-muted-foreground">(Ty)</span>}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 break-all text-sm text-muted-foreground">
          {user.email}
          {user.emailVerified ? (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-read-marker" aria-label="e-mail potwierdzony" />
          ) : (
            <span className="shrink-0 rounded bg-amber-500/15 px-1.5 text-xs text-amber-700 dark:text-amber-400">niepotwierdzony</span>
          )}
        </p>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div><dt className="inline">Konto od: </dt><dd className="inline tabular-nums">{fmtDate(user.createdAt)}</dd></div>
          <div><dt className="inline">Aktywność: </dt><dd className="inline tabular-nums">{fmtDate(user.lastActiveAt)}</dd></div>
          <div><dt className="inline">Logowanie: </dt><dd className="inline">{user.providers.map((p) => (p === "credential" ? "e-mail" : p)).join(", ") || "—"}</dd></div>
        </dl>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {user.counts.read} rozdz. · {user.counts.favorites} ulubionych · {user.counts.notes} notatek · {user.counts.highlights} wyróżnień · {user.counts.plans} planów
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Akcje dla ${user.email}`} disabled={run.isPending}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => run.mutate(() => patchAdminUser(user.id, { role: isAdmin ? "user" : "admin" }))}
          >
            {isAdmin ? "Odbierz rolę administratora" : "Nadaj rolę administratora"}
          </DropdownMenuItem>
          {!user.emailVerified && (
            <DropdownMenuItem onSelect={() => run.mutate(() => patchAdminUser(user.id, { emailVerified: true }))}>
              Oznacz e-mail jako potwierdzony
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              if (window.confirm(`Wylogować ${user.email} ze wszystkich urządzeń?`)) run.mutate(() => revokeUserSessions(user.id));
            }}
          >
            Wyloguj ze wszystkich urządzeń
          </DropdownMenuItem>
          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  if (window.confirm(`Trwale usunąć konto ${user.email} wraz z całym postępem, ulubionymi i notatkami? Tego nie da się cofnąć.`))
                    run.mutate(() => deleteAdminUser(user.id));
                }}
              >
                Usuń konto
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function AdminContent() {
  const { user: me } = useAuthed();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [q]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: qk.adminUsers(q, page),
    queryFn: () => fetchAdminUsers(q, page),
    retry: false,
    placeholderData: (prev) => prev,
  });

  if (isError && error instanceof Error && error.message.startsWith("403")) {
    return <p className="mt-10 text-center text-sm text-muted-foreground" role="alert">Ta strona jest tylko dla administratorów.</p>;
  }
  if (isLoading)
    return (
      <div className="mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[74px] rounded-xl" />)}</div>
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  if (isError || !data)
    return (
      <div className="mt-10 text-center" role="alert">
        <p className="text-sm text-muted-foreground">Nie udało się wczytać użytkowników.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Spróbuj ponownie</Button>
      </div>
    );

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile label="Użytkownicy" value={data.summary.total} />
        <Tile label="Potwierdzeni" value={data.summary.verified} />
        <Tile label="Administratorzy" value={data.summary.admins} />
        <Tile label="Nowi (7 dni)" value={data.summary.newLast7d} />
        <Tile label="Aktywni (7 dni)" value={data.summary.activeLast7d} />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj po imieniu lub e-mailu" className="pl-9" aria-label="Szukaj użytkownika" data-testid="input-admin-search" />
      </div>

      {data.users.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Brak użytkowników pasujących do „{q}".</p>
      ) : (
        <ul className={cn("space-y-3 transition-opacity", isFetching && "opacity-60")}>
          {data.users.map((u) => (
            <UserRow key={u.id} user={u} isSelf={u.id === me?.id} onChanged={refresh} />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Paginacja">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Poprzednia
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">{page} / {pages} · {data.total} kont</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Następna <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </nav>
      )}
      <p className="text-xs text-muted-foreground">
        Widzisz konta i liczniki aktywności. Treść notatek i ulubionych użytkowników pozostaje prywatna.
      </p>
    </div>
  );
}

export default function AdminPage() {
  const { data: state, isLoading } = useUserState();
  return (
    <div className="relative z-10 min-h-screen">
      <AppHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="font-display text-xl font-bold leading-tight">Panel administratora</h1>
        <RequireAuth what="Panel administratora">
          {isLoading ? (
            <Skeleton className="mt-6 h-40 w-full rounded-xl" />
          ) : state?.role === "admin" ? (
            <AdminContent />
          ) : (
            <div className="mt-10 text-center" role="alert">
              <p className="text-sm text-muted-foreground">Ta strona jest tylko dla administratorów.</p>
              <Button asChild variant="outline" size="sm" className="mt-3"><Link href="/">Wróć na stronę główną</Link></Button>
            </div>
          )}
        </RequireAuth>
      </main>
    </div>
  );
}
