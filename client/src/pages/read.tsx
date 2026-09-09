import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { AppHeader, useAuthed } from "@/components/app-header";
import { VerseRow } from "@/components/verse-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import {
  addFavorite,
  fetchFavorites,
  fetchReadChapters,
  invalidateUserState,
  markRead,
  qk,
  removeFavorite,
  savePosition,
  unmarkRead,
  type ChapterDto,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export default function ReadPage() {
  const params = useParams<{ book: string; chapter: string }>();
  const bookId = params.book ?? "";
  const chapter = Number(params.chapter ?? 1);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { authed } = useAuthed();

  const [openVerses, setOpenVerses] = useState<Set<number>>(new Set());

  const { data, isLoading, isError } = useQuery<ChapterDto>({
    queryKey: qk.chapter(bookId, chapter),
  });

  const { data: favorites } = useQuery({
    queryKey: qk.favorites(bookId, chapter),
    queryFn: () => fetchFavorites(bookId, chapter),
    enabled: authed,
  });

  const { data: readChapters } = useQuery({
    queryKey: qk.read(bookId),
    queryFn: () => fetchReadChapters(bookId),
    enabled: authed,
  });

  const favoriteSet = useMemo(
    () => new Set((favorites ?? []).map((f) => f.verseFrom)),
    [favorites],
  );
  const isRead = useMemo(
    () => (readChapters ?? []).some((r) => r.chapter === chapter),
    [readChapters, chapter],
  );

  // Nowy rozdział: zwiń polskie wersety i zapisz ostatnią pozycję czytania.
  // Bez konta nie ma gdzie jej zapisać — samo czytanie działa tak samo.
  useEffect(() => {
    setOpenVerses(new Set());
    window.scrollTo({ top: 0 });
    if (authed && bookId && chapter) {
      savePosition(bookId, chapter)
        .then(() => invalidateUserState())
        .catch(() => undefined);
    }
  }, [authed, bookId, chapter]);

  const readMutation = useMutation({
    mutationFn: async ({ mark, ch }: { mark: boolean; ch: number }) =>
      mark ? markRead(bookId, ch) : unmarkRead(bookId, ch),
    onSuccess: () => invalidateUserState(),
  });

  const allOpen = !!data && data.verses.length > 0 && openVerses.size === data.verses.length;

  const toggleAll = () => {
    if (!data) return;
    setOpenVerses(allOpen ? new Set() : new Set(data.verses.map((v) => v.v)));
  };

  const toggleVerse = (v: number) =>
    setOpenVerses((prev) => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });

  /** Zaproszenie do logowania zamiast cichego 401 z API. */
  const promptLogin = (what: string) => {
    toast({
      title: "Zaloguj się, aby zapisać",
      description: `${what} zapisujemy na koncie, żeby był dostępny też na telefonie.`,
      duration: 6000,
      action: (
        <ToastAction
          altText="Przejdź do logowania"
          onClick={() => navigate("/login")}
          data-testid="button-login-prompt"
        >
          Zaloguj
        </ToastAction>
      ),
    });
  };

  const toggleFavorite = async (v: number) => {
    if (!authed) return promptLogin("Ulubione wersety");
    if (favoriteSet.has(v)) await removeFavorite(bookId, chapter, v);
    else await addFavorite(bookId, chapter, v);
    invalidateUserState();
  };

  /** Auto-zapis postępu: krótki popup (2 s) z możliwością cofnięcia, zawsze da się zamknąć krzyżykiem. */
  const saveProgress = (ch: number, description: string) => {
    readMutation.mutate({ mark: true, ch });
    toast({
      title: "Zapisano postęp",
      description,
      duration: 2000,
      action: (
        <ToastAction
          altText="Cofnij zapis postępu"
          onClick={() => readMutation.mutate({ mark: false, ch })}
          data-testid="button-undo-progress"
        >
          Cofnij
        </ToastAction>
      ),
    });
  };

  const goNext = () => {
    if (!data?.nav.next) return;
    if (authed && !isRead) {
      saveProgress(chapter, `${data.book.namePl} ${chapter} oznaczony jako przeczytany.`);
    }
    navigate(`/czytaj/${data.nav.next.book}/${data.nav.next.chapter}`);
  };

  if (isError) {
    return (
      <div className="relative z-10 min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h1 className="font-display text-xl font-bold">Nie znaleziono rozdziału</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sprawdź adres albo wróć do wyboru księgi.
          </p>
          <Button asChild className="mt-6">
            <Link href="/">Wybór księgi</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-screen pb-28 sm:pb-12">
      <AppHeader />

      <main className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        <Link
          href={`/ksiega/${bookId}`}
          className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
          data-testid="link-back-chapters"
        >
          <ArrowLeft className="h-4 w-4" /> {data?.book.namePl ?? "Rozdziały"}
        </Link>

        {isLoading || !data ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-8 w-64" />
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <div className="mt-4 border-b border-border pb-5">
              <h1 className="font-display text-xl font-bold leading-tight">
                {data.book.namePl} {data.book.chapter}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.translations.en.name} ({data.translations.en.shortName}) ·{" "}
                {data.translations.pl.name} ({data.translations.pl.shortName}) · rozdział{" "}
                {data.book.chapter} z {data.book.totalChapters}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAll}
                  data-testid="button-toggle-all-pl"
                >
                  {allOpen ? (
                    <ChevronsDownUp className="mr-1.5 h-4 w-4" />
                  ) : (
                    <ChevronsUpDown className="mr-1.5 h-4 w-4" />
                  )}
                  {allOpen ? "Zwiń wszystkie PL" : "Rozwiń wszystkie PL"}
                </Button>

                <Button
                  variant={isRead ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    if (!authed) {
                      promptLogin("Postęp czytania");
                    } else if (isRead) {
                      readMutation.mutate({ mark: false, ch: chapter });
                      toast({ title: "Cofnięto oznaczenie", duration: 4000 });
                    } else {
                      saveProgress(chapter, `${data.book.namePl} ${chapter} oznaczony jako przeczytany.`);
                    }
                  }}
                  className={cn(isRead && "text-read-marker")}
                  data-testid="button-mark-read"
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  {isRead ? "Przeczytany" : "Oznacz jako przeczytany"}
                </Button>
              </div>
            </div>

            <div className="py-4">
              {data.verses.map((verse) => (
                <VerseRow
                  key={verse.v}
                  verse={verse}
                  open={openVerses.has(verse.v)}
                  favorite={favoriteSet.has(verse.v)}
                  onToggle={() => toggleVerse(verse.v)}
                  onToggleFavorite={() => toggleFavorite(verse.v)}
                />
              ))}

              {data.extraPl.length > 0 && (
                <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/40 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Dodatkowe wersety w Biblii Gdańskiej
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Numeracja przekładów nie zawsze się pokrywa — te wersety nie mają odpowiednika w WEB.
                  </p>
                  {data.extraPl.map((e) => (
                    <p key={e.v} className="verse-pl mt-3">
                      <span className="mr-2 not-italic text-verse-number">{e.v}</span>
                      {e.pl}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Jedna nawigacja: przyklejona do dołu na mobile, w treści na desktopie */}
            <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm sm:static sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-5 sm:backdrop-blur-none">
              <ChapterNavButtons data={data} onNext={goNext} />
            </nav>
          </>
        )}
      </main>
    </div>
  );
}

function ChapterNavButtons({ data, onNext }: { data: ChapterDto; onNext: () => void }) {
  const side = "flex-1 sm:flex-none";
  return (
    <>
      {data.nav.prev ? (
        <Button asChild variant="outline" className={side} data-testid="link-prev-chapter">
          <Link href={`/czytaj/${data.nav.prev.book}/${data.nav.prev.chapter}`}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Poprzedni
          </Link>
        </Button>
      ) : (
        <span className={side} />
      )}

      <Link
        href={`/ksiega/${data.book.id}`}
        className="shrink-0 rounded-md px-2 text-xs tabular-nums text-muted-foreground transition-colors hover:text-foreground"
        data-testid="link-chapter-index"
      >
        {data.book.chapter} / {data.book.totalChapters}
      </Link>

      {data.nav.next ? (
        <Button onClick={onNext} className={side} data-testid="button-next-chapter">
          Następny <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      ) : (
        <span className={side} />
      )}
    </>
  );
}
