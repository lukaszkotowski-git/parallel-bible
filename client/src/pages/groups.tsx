import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, Plus, Users } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  createGroup,
  deleteGroup,
  fetchGroup,
  fetchGroups,
  invalidateGroups,
  joinGroup,
  patchGroup,
  qk,
  regenerateGroupCode,
  removeGroupMember,
} from "@/lib/api";
import { chapterHref, chapterLabel, plural } from "@/lib/format";
import { announceReward } from "@/lib/rewards";
import { queryClient } from "@/lib/queryClient";
import { PLAN_TEMPLATES } from "@shared/plans";

const errorText = (e: unknown) =>
  e instanceof Error ? e.message.replace(/^\d+:\s*/, "").replace(/^\{"message":"(.*)"\}$/, "$1") : "Spróbuj ponownie.";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative z-10 min-h-screen">
      <AppHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="flex items-center gap-2 font-display text-xl font-bold leading-tight">
          <Users className="h-5 w-5 text-primary" aria-hidden="true" /> {title}
        </h1>
        {children}
      </main>
    </div>
  );
}

// ---------- lista grup ----------

function GroupsList() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: groups, isLoading, isError, refetch } = useQuery({ queryKey: qk.groups, queryFn: fetchGroups, retry: 1 });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const create = useMutation({
    mutationFn: () => createGroup(name.trim()),
    onSuccess: (res) => {
      announceReward(res);
      invalidateGroups();
      navigate(`/grupy/${res.id}`);
    },
    onError: (e) => toast({ title: "Nie udało się utworzyć grupy", description: errorText(e), variant: "destructive", duration: 5000 }),
  });
  const join = useMutation({
    mutationFn: () => joinGroup(code.trim()),
    onSuccess: (res) => {
      announceReward(res);
      invalidateGroups();
      navigate(`/grupy/${res.id}`);
    },
    onError: (e) => toast({ title: "Nie udało się dołączyć", description: errorText(e), variant: "destructive", duration: 5000 }),
  });

  return (
    <div className="mt-6 space-y-8">
      {isLoading ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : isError ? (
        <div className="text-center" role="alert">
          <p className="text-sm text-muted-foreground">Nie udało się wczytać grup.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Spróbuj ponownie</Button>
        </div>
      ) : groups && groups.length > 0 ? (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/grupy/${g.id}`} className="block rounded-xl border border-card-border bg-card p-4 shadow-xs transition-colors hover-elevate" data-testid={`group-${g.id}`}>
                <span className="block font-display text-lg font-bold leading-tight">{g.name}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {g.memberCount} {plural(g.memberCount, "osoba", "osoby", "osób")} · dziś czytało {g.readToday}
                  {g.hasPlan && " · wspólny plan"}
                  {g.isOwner && " · Ty prowadzisz"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
          Nie należysz jeszcze do żadnej grupy. Załóż własną (rodzina, grupa domowa) albo dołącz kodem od znajomego.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <form
          className="space-y-3 rounded-xl border border-card-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length >= 2) create.mutate();
          }}
        >
          <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Plus className="h-4 w-4" aria-hidden="true" /> Nowa grupa</h2>
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Nazwa</Label>
            <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="np. Grupa domowa" data-testid="input-group-name" />
          </div>
          <Button type="submit" className="w-full" disabled={name.trim().length < 2 || create.isPending} data-testid="button-create-group">Utwórz grupę</Button>
        </form>

        <form
          className="space-y-3 rounded-xl border border-card-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim().length >= 4) join.mutate();
          }}
        >
          <h2 className="text-sm font-semibold">Mam kod zaproszenia</h2>
          <div className="space-y-1.5">
            <Label htmlFor="group-code">Kod</Label>
            <Input id="group-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={32} placeholder="np. K7M2QX9A" className="uppercase" data-testid="input-group-code" />
          </div>
          <Button type="submit" variant="outline" className="w-full" disabled={code.trim().length < 4 || join.isPending} data-testid="button-join-group">Dołącz</Button>
        </form>
      </div>

      <p className="text-xs text-muted-foreground">
        Grupa widzi o Tobie tylko imię i to, czy dziś czytałeś — bez liczb, notatek i ulubionych.
      </p>
    </div>
  );
}

export function GroupsPage() {
  return (
    <Shell title="Grupy czytelnicze">
      <RequireAuth what="Grupy czytelnicze">
        <GroupsList />
      </RequireAuth>
    </Shell>
  );
}

// ---------- dołączanie z linku ----------

export function GroupJoinPage() {
  const { code = "" } = useParams<{ code: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const join = useMutation({
    mutationFn: () => joinGroup(code),
    onSuccess: (res) => {
      announceReward(res);
      invalidateGroups();
      navigate(`/grupy/${res.id}`);
    },
    onError: (e) => toast({ title: "Nie udało się dołączyć", description: errorText(e), variant: "destructive", duration: 5000 }),
  });

  return (
    <Shell title="Zaproszenie do grupy">
      <RequireAuth what="Dołączenie do grupy">
        <div className="mt-8 rounded-xl border border-card-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Ktoś zaprosił Cię do wspólnego czytania.</p>
          <p className="mt-2 font-mono text-lg tracking-widest">{code.toUpperCase()}</p>
          <Button className="mt-4" disabled={join.isPending} onClick={() => join.mutate()} data-testid="button-accept-invite">
            Dołącz do grupy
          </Button>
        </div>
      </RequireAuth>
    </Shell>
  );
}

// ---------- szczegóły grupy ----------

function GroupDetail({ id }: { id: string }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: g, isLoading, isError, error, refetch } = useQuery({ queryKey: qk.group(id), queryFn: () => fetchGroup(id), retry: false });
  const [copied, setCopied] = useState(false);
  const [templateId, setTemplateId] = useState(PLAN_TEMPLATES[0]!.id);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: qk.group(id) });
    invalidateGroups();
  };
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (e) => toast({ title: "Nie udało się", description: errorText(e), variant: "destructive", duration: 5000 }),
  });

  if (isLoading) return <Skeleton className="mt-6 h-64 rounded-xl" />;
  if (isError || !g) {
    const missing = error instanceof Error && error.message.startsWith("404");
    return (
      <div className="mt-10 text-center" role="alert">
        <p className="text-sm text-muted-foreground">{missing ? "Nie ma takiej grupy albo do niej nie należysz." : "Nie udało się wczytać grupy."}</p>
        <div className="mt-3 flex justify-center gap-2">
          {!missing && <Button variant="outline" size="sm" onClick={() => refetch()}>Spróbuj ponownie</Button>}
          <Button asChild variant="outline" size="sm"><Link href="/grupy">Moje grupy</Link></Button>
        </div>
      </div>
    );
  }

  const inviteUrl = `${window.location.origin}/#/grupy/dolacz/${g.inviteCode}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Skopiuj link ręcznie", description: inviteUrl, duration: 8000 });
    }
  };

  return (
    <div className="mt-2 space-y-6">
      {g.description && <p className="text-sm text-muted-foreground">{g.description}</p>}
      <h2 className="font-display text-2xl font-bold leading-tight">{g.name}</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-card-border bg-card p-4 shadow-xs">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Dziś czytało</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums leading-none">{g.readToday} <span className="text-base font-normal text-muted-foreground">/ {g.members.length}</span></p>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-4 shadow-xs">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Wspólne czytanie</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums leading-none">{g.sharedRun.current} <span className="text-base font-normal text-muted-foreground">{plural(g.sharedRun.current, "dzień", "dni", "dni")}</span></p>
          <p className="mt-1.5 text-xs text-muted-foreground">rekord {g.sharedRun.best} · liczy się, gdy czyta co najmniej połowa</p>
        </div>
      </div>

      {g.plan && (
        <section className="rounded-xl border border-card-border bg-card p-4 shadow-xs" aria-label="Wspólny plan">
          <h3 className="font-semibold">{g.plan.name}</h3>
          <p className="text-xs text-muted-foreground">
            {g.plan.finished ? "Plan zakończony" : `Dzień ${g.plan.currentDay} z ${g.plan.days}`}
          </p>
          {g.plan.today.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {g.plan.today.map((c) => (
                <Link
                  key={`${c.bookId}${c.chapter}`}
                  href={chapterHref(c.bookId, c.chapter)}
                  className={"inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm transition-colors hover-elevate " + (c.read ? "border-read-marker/40 bg-read-marker/10 text-read-marker" : "border-card-border bg-card")}
                >
                  {c.read && <Check className="h-3.5 w-3.5" aria-label="przeczytany" />}
                  {chapterLabel(c.bookId, c.chapter)}
                </Link>
              ))}
            </div>
          )}
          {g.plan.myOverdue > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">Masz do nadrobienia {g.plan.myOverdue} {plural(g.plan.myOverdue, "rozdział", "rozdziały", "rozdziałów")} — bez pośpiechu.</p>
          )}
        </section>
      )}

      <section aria-label="Członkowie">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Członkowie</h3>
        <ul className="divide-y divide-border rounded-xl border border-card-border bg-card">
          {g.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 px-4 py-3" data-testid={`member-${m.userId}`}>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {m.name}
                {m.isMe && <span className="font-normal text-muted-foreground"> (Ty)</span>}
                {m.isOwner && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-normal text-primary">prowadzi</span>}
              </span>
              {m.onTrack !== null && (
                <span className="text-xs text-muted-foreground">{m.onTrack ? "na bieżąco" : "nadrabia"}</span>
              )}
              <span className={m.readToday ? "flex items-center gap-1 text-xs text-read-marker" : "text-xs text-muted-foreground"}>
                {m.readToday ? <><Check className="h-3.5 w-3.5" aria-hidden="true" /> dziś czytał(a)</> : "jeszcze dziś nie"}
              </span>
              {g.isOwner && !m.isMe && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={act.isPending}
                  onClick={() => { if (window.confirm(`Usunąć ${m.name} z grupy?`)) act.mutate(() => removeGroupMember(id, m.userId)); }}>
                  Usuń
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-card-border bg-card p-4" aria-label="Zaproszenie">
        <h3 className="text-sm font-semibold">Zaproś do grupy</h3>
        <p className="mt-1 text-xs text-muted-foreground">Kod: <span className="font-mono text-sm tracking-widest text-foreground" data-testid="text-invite-code">{g.inviteCode}</span></p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={copy} data-testid="button-copy-invite">
            {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />} {copied ? "Skopiowano" : "Kopiuj link zaproszenia"}
          </Button>
          {g.isOwner && (
            <Button size="sm" variant="ghost" disabled={act.isPending}
              onClick={() => { if (window.confirm("Wygenerować nowy kod? Stary link przestanie działać.")) act.mutate(() => regenerateGroupCode(id)); }}>
              Nowy kod
            </Button>
          )}
        </div>
      </section>

      {g.isOwner && (
        <section className="space-y-3 rounded-xl border border-card-border bg-card p-4" aria-label="Ustawienia grupy">
          <h3 className="text-sm font-semibold">Wspólny plan czytania</h3>
          <div className="flex flex-wrap gap-2">
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              aria-label="Plan"
              className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PLAN_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <Button size="sm" disabled={act.isPending} data-testid="button-set-group-plan"
              onClick={() => {
                const t = PLAN_TEMPLATES.find((x) => x.id === templateId)!;
                act.mutate(() => patchGroup(id, { plan: { name: t.name, books: t.books, days: t.days } }));
              }}>
              {g.plan ? "Zmień plan" : "Ustaw plan"}
            </Button>
            {g.plan && (
              <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate(() => patchGroup(id, { plan: null }))}>Usuń plan</Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Plan startuje od dzisiaj. Każdy czyta we własnym tempie — grupa widzi tylko, czy ktoś jest na bieżąco.</p>
          <RenameForm name={g.name} description={g.description} onSave={(patch) => act.mutate(() => patchGroup(id, patch))} pending={act.isPending} />
        </section>
      )}

      <div className="flex justify-end">
        {g.isOwner ? (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={act.isPending} data-testid="button-delete-group"
            onClick={() => {
              if (window.confirm(`Usunąć grupę „${g.name}” dla wszystkich członków? Tego nie da się cofnąć.`))
                act.mutate(async () => { await deleteGroup(id); invalidateGroups(); navigate("/grupy"); });
            }}>
            Usuń grupę
          </Button>
        ) : (
          <Button variant="ghost" size="sm" disabled={act.isPending} data-testid="button-leave-group"
            onClick={() => {
              if (window.confirm(`Opuścić grupę „${g.name}”?`))
                act.mutate(async () => { await removeGroupMember(id, "me"); invalidateGroups(); navigate("/grupy"); });
            }}>
            Opuść grupę
          </Button>
        )}
      </div>
    </div>
  );
}

function RenameForm({ name, description, onSave, pending }: { name: string; description: string | null; onSave: (p: { name: string; description: string | null }) => void; pending: boolean }) {
  const [n, setN] = useState(name);
  const [d, setD] = useState(description ?? "");
  const dirty = n.trim() !== name || d.trim() !== (description ?? "");
  return (
    <form className="space-y-2 border-t border-border pt-3" onSubmit={(e) => { e.preventDefault(); if (dirty && n.trim().length >= 2) onSave({ name: n.trim(), description: d.trim() || null }); }}>
      <Label htmlFor="edit-group-name" className="text-xs text-muted-foreground">Nazwa i opis</Label>
      <Input id="edit-group-name" value={n} onChange={(e) => setN(e.target.value)} maxLength={60} />
      <Textarea value={d} onChange={(e) => setD(e.target.value)} maxLength={300} rows={2} placeholder="Opis (opcjonalnie)" aria-label="Opis grupy" className="text-sm" />
      <Button type="submit" size="sm" variant="outline" disabled={!dirty || n.trim().length < 2 || pending}>Zapisz</Button>
    </form>
  );
}

export function GroupDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  return (
    <Shell title="Grupa">
      <div className="mt-1">
        <Link href="/grupy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">← Moje grupy</Link>
      </div>
      <RequireAuth what="Grupy czytelnicze">
        <GroupDetail id={id} />
      </RequireAuth>
    </Shell>
  );
}
