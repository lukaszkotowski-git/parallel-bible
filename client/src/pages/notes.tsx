import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchNotes, qk } from "@/lib/api";
import { chapterHref, chapterLabel } from "@/lib/format";

function NotesList() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: qk.notes, queryFn: fetchNotes, retry: 1 });
  if (isLoading) return <Skeleton className="mt-6 h-40 w-full rounded-xl" />;
  if (isError)
    return (
      <div className="mt-10 text-center" role="alert">
        <p className="text-sm text-muted-foreground">Nie udało się wczytać notatek.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Spróbuj ponownie</Button>
      </div>
    );
  if (!data?.length)
    return (
      <p className="mt-10 text-center text-sm text-muted-foreground">
        Brak notatek. Dodasz je w widoku czytania: menu „⋯" przy wersecie → „Dodaj notatkę".
      </p>
    );
  return (
    <ul className="mt-6 space-y-3">
      {data.map((n) => (
        <li key={`${n.bookId}${n.chapter}${n.verse}`}>
          <Link
            href={chapterHref(n.bookId, n.chapter)}
            className="block rounded-xl border border-card-border bg-card p-4 transition-colors hover-elevate"
          >
            <span className="block text-xs font-medium text-primary">
              {chapterLabel(n.bookId, n.chapter)}:{n.verse}
            </span>
            <span className="mt-1 block whitespace-pre-wrap break-words text-sm">{n.text}</span>
            <span className="mt-2 block text-xs text-muted-foreground">
              {new Date(n.updatedAt).toLocaleDateString("pl-PL")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function NotesPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <AppHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="font-display text-xl font-bold leading-tight">Moje notatki</h1>
        <RequireAuth what="Notatki">
          <NotesList />
        </RequireAuth>
      </main>
    </div>
  );
}
