import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthed } from "@/components/app-header";

/** Strony z danymi konta: anonimowy czytelnik dostaje zaproszenie zamiast 401. */
export function RequireAuth({ what, children }: { what: string; children: React.ReactNode }) {
  const { authed, pending } = useAuthed();
  if (pending) return <Skeleton className="mt-6 h-40 w-full rounded-xl" />;
  if (!authed) {
    return (
      <div className="mt-10 rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
        <p className="text-sm text-muted-foreground">{what} wymagają konta — czytanie nadal jest publiczne.</p>
        <Button asChild className="mt-4">
          <Link href="/login">Zaloguj się</Link>
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
