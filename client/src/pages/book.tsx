import { Link, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, CheckCheck, RotateCcw } from "lucide-react";
import { AppHeader, useAuthed, useUserState } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SupportButton } from "@/components/support-dialog";
import { useToast } from "@/hooks/use-toast";
import { announceReward } from "@/lib/rewards";
import { fetchReadChapters, invalidateUserState, qk, setBookRead, type BookDto } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BOOK_TITLE_VT } from "@/lib/view-transition";

export default function BookPage() {
  const { book: bookId = "" } = useParams<{ book: string }>();
  const { data: books, isLoading, isError, refetch } = useQuery<BookDto[]>({
    queryKey: qk.books,
    retry: 1,
  });
  const { authed } = useAuthed();
  const { data: read } = useQuery({
    queryKey: qk.read(bookId),
    queryFn: () => fetchReadChapters(bookId),
    enabled: authed,
  });
  const { data: state } = useUserState();

  const { toast } = useToast();
  const bulk = useMutation({
    mutationFn: (read: boolean) => setBookRead(bookId, read),
    onSuccess: (reward, read) => {
      invalidateUserState();
      announceReward(reward);
      toast({
        title: read ? "Oznaczono całą księgę jako przeczytaną" : "Odznaczono całą księgę",
        description: read ? "Trafia do postępu, ale serię i punkty zdobywasz, czytając." : undefined,
        duration: 4000,
      });
    },
    onError: () => toast({ title: "Nie udało się zapisać", variant: "destructive", duration: 4000 }),
  });

  const book = books?.find((b) => b.id === bookId);
  const readSet = new Set((read ?? []).map((r) => r.chapter));
  const current = state?.position?.bookId === bookId ? state.position.chapter : null;

  return (
    <div className="relative z-10 min-h-screen">
      <AppHeader />

      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
          data-testid="link-back-books"
        >
          <ArrowLeft className="h-4 w-4" /> Wybór księgi
        </Link>

        {isLoading ? (
          <>
            <Skeleton className="mt-4 h-8 w-56" />
            <Skeleton className="mt-2 h-4 w-72" />
            <div className="mt-6 grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
              {Array.from({ length: 30 }).map((_, i) => (
                <Skeleton key={i} className="h-11 rounded-md" />
              ))}
            </div>
          </>
        ) : isError ? (
          <div className="mt-10 text-center" role="alert">
            <p className="text-sm text-muted-foreground">Nie udało się wczytać księgi.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              Spróbuj ponownie
            </Button>
          </div>
        ) : !book ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Nie ma takiej księgi. Wróć do wyboru księgi.
          </p>
        ) : (
          <>
            <h1 className="mt-4 w-fit font-display text-xl font-bold leading-tight" style={{ viewTransitionName: BOOK_TITLE_VT }}>
              {book.namePl}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {book.nameEn} · {book.chapterCount} rozdziałów · przeczytane{" "}
              <span className="tabular-nums text-read-marker">{readSet.size}</span>
            </p>

            {authed && (
              <div className="mt-4 flex flex-wrap gap-2">
                {readSet.size < book.chapterCount && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulk.isPending}
                    onClick={() => bulk.mutate(true)}
                    data-testid="button-mark-book-read"
                  >
                    <CheckCheck className="mr-1.5 h-4 w-4" /> Oznacz całą księgę jako przeczytaną
                  </Button>
                )}
                {readSet.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={bulk.isPending}
                    onClick={() => {
                      if (window.confirm(`Odznaczyć wszystkie przeczytane rozdziały księgi „${book.namePl}"?`)) bulk.mutate(false);
                    }}
                    data-testid="button-unmark-book-read"
                  >
                    <RotateCcw className="mr-1.5 h-4 w-4" /> Odznacz całą księgę
                  </Button>
                )}
              </div>
            )}

            <div className="mt-6 grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
              {Array.from({ length: book.chapterCount }, (_, i) => i + 1).map((n) => {
                const isRead = readSet.has(n);
                return (
                  <Link
                    key={n}
                    href={`/czytaj/${book.id}/${n}`}
                    className={cn(
                      "relative flex h-11 items-center justify-center rounded-md border text-sm tabular-nums transition-colors hover-elevate",
                      isRead
                        ? "border-read-marker/40 bg-read-marker/10 text-read-marker"
                        : "border-card-border bg-card text-foreground",
                      current === n && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                    )}
                    data-testid={`link-chapter-${book.id}-${n}`}
                  >
                    {n}
                    {isRead && (
                      <Check className="absolute right-0.5 top-0.5 h-3 w-3" aria-hidden="true" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Ten sam przycisk co na stronie głównej; sam się ukrywa, gdy nie skonfigurowano numerów. */}
            <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border pt-6">
              <SupportButton variant="pill" />
              <span className="text-xs text-muted-foreground">Aplikacja jest darmowa. Jeśli Ci służy, możesz dobrowolnie ją wesprzeć.</span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
