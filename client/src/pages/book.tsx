import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react";
import { AppHeader, useAuthed, useUserState } from "@/components/app-header";
import { Skeleton } from "@/components/ui/skeleton";
import { qk, fetchReadChapters, type BookDto } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function BookPage() {
  const { book: bookId = "" } = useParams<{ book: string }>();
  const { data: books, isLoading } = useQuery<BookDto[]>({ queryKey: qk.books });
  const { authed } = useAuthed();
  const { data: read } = useQuery({
    queryKey: qk.read(bookId),
    queryFn: () => fetchReadChapters(bookId),
    enabled: authed,
  });
  const { data: state } = useUserState();

  const book = books?.find((b) => b.id === bookId);
  const readSet = new Set((read ?? []).map((r) => r.chapter));
  const current = state?.position?.bookId === bookId ? state.position.chapter : null;

  return (
    <div className="relative z-10 min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
          data-testid="link-back-books"
        >
          <ArrowLeft className="h-4 w-4" /> Wybór księgi
        </Link>

        {isLoading || !book ? (
          <Skeleton className="mt-4 h-8 w-56" />
        ) : (
          <>
            <h1 className="mt-4 font-display text-xl font-bold leading-tight">{book.namePl}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {book.nameEn} · {book.chapterCount} rozdziałów · przeczytane{" "}
              <span className="tabular-nums text-read-marker">{readSet.size}</span>
            </p>

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
          </>
        )}
      </main>
    </div>
  );
}
