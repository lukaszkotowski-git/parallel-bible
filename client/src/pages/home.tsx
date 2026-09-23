import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BookOpen, Search } from "lucide-react";
import { AmbientLight } from "@/components/ambient-light";
import { HeroDemo } from "@/components/hero-demo";
import { BlurWords } from "@/components/motion-text";
import { SupportButton } from "@/components/support-dialog";
import { TodayCards } from "@/components/today-card";
import { readLocalPosition } from "@/lib/last-position";
import { Button } from "@/components/ui/button";
import { AppHeader, useAuthed, useUserState } from "@/components/app-header";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { qk, fetchReadChapters, type BookDto } from "@/lib/api";
import { cn } from "@/lib/utils";
import { nameBookTitle } from "@/lib/view-transition";

/**
 * Animacje wejścia (tytuł słowo po słowie, kaskada kafelków) grają raz na załadowanie strony —
 * przy powrocie z księgi lista ma być od razu pod ręką.
 */
let introPlayed = false;

type ContinueTarget = { bookId: string; namePl: string; chapter: number };

/**
 * Pozycja z konta ma pierwszeństwo; bez konta (albo gdy konto jeszcze nic nie zapisało)
 * wracamy do ostatniego miejsca zapamiętanego na tym urządzeniu.
 * `undefined` = jeszcze nie wiadomo (sesja się ładuje), `null` = nie ma dokąd wracać.
 */
function useContinueTarget(): ContinueTarget | null | undefined {
  const { authed, pending } = useAuthed();
  const { data: state, isLoading: stateLoading } = useUserState();
  const { data: books } = useQuery<BookDto[]>({ queryKey: qk.books });
  if (pending || (authed && stateLoading)) return undefined;

  let target: { bookId: string; namePl: string; chapter: number } | null = state?.position ?? null;
  if (!target) {
    const local = readLocalPosition();
    const book = local && books?.find((b) => b.id === local.bookId);
    if (local && book && local.chapter <= book.chapterCount) {
      target = { bookId: book.id, namePl: book.namePl, chapter: local.chapter };
    }
  }
  return target;
}

function ContinueCard({ target }: { target: ContinueTarget }) {
  const { bookId, namePl, chapter } = target;

  return (
    <Link
      href={`/czytaj/${bookId}/${chapter}`}
      className="group flex items-center gap-4 rounded-xl border border-card-border bg-card p-4 shadow-xs transition-colors hover-elevate sm:p-5"
      data-testid="link-continue-reading"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <BookOpen className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs uppercase tracking-wide text-muted-foreground">
          Kontynuuj czytanie
        </span>
        <span className="block truncate font-display text-lg font-bold leading-tight">
          {namePl} {chapter}
        </span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function BookTile({
  book,
  readCount,
  introDelay,
}: {
  book: BookDto;
  readCount: number;
  /** Opóźnienie kaskady wejścia (s); `null` = bez animacji wejścia. */
  introDelay: number | null;
}) {
  const done = readCount >= book.chapterCount;
  return (
    <Link
      href={`/ksiega/${book.id}`}
      onClick={() => nameBookTitle(book.id)}
      className={cn(
        "group relative flex flex-col justify-between gap-2 overflow-hidden rounded-lg border border-card-border bg-card p-3 text-left transition-colors hover-elevate",
        introDelay !== null && "animate-tile-in",
      )}
      style={introDelay !== null ? { animationDelay: `${introDelay}s` } : undefined}
      data-testid={`link-book-${book.id}`}
    >
      <span className="min-w-0">
        <span className="block w-fit max-w-full truncate text-sm font-medium leading-snug" data-vt-book={book.id}>
          {book.shortPl}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{book.nameEn}</span>
      </span>
      <span className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">{book.chapterCount} rozdz.</span>
        {readCount > 0 && (
          <span
            className={cn(
              "tabular-nums font-medium",
              done ? "text-read-marker" : "text-primary",
            )}
          >
            {done ? "✓" : `${readCount}/${book.chapterCount}`}
          </span>
        )}
      </span>
      <motion.span
        className="absolute bottom-0 left-0 h-0.5 bg-read-marker/70"
        initial={introDelay !== null ? { width: 0 } : false}
        animate={{ width: `${(readCount / book.chapterCount) * 100}%` }}
        transition={{ duration: 0.9, delay: (introDelay ?? 0) + 0.2, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden="true"
      />
    </Link>
  );
}

function BookSection({
  title,
  books,
  readByBook,
  intro,
  introOffset = 0,
}: {
  title: string;
  books: BookDto[];
  readByBook: Record<string, number>;
  intro: boolean;
  /** Ile kafelków stoi przed tą sekcją — kaskada ciągnie się przez obie sekcje. */
  introOffset?: number;
}) {
  if (books.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        <span className="text-xs font-normal normal-case tabular-nums">{books.length} ksiąg</span>
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {books.map((b, i) => (
          <BookTile
            key={b.id}
            book={b}
            readCount={readByBook[b.id] ?? 0}
            introDelay={intro ? Math.min((introOffset + i) * 0.014, 0.7) : null}
          />
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const { authed, pending } = useAuthed();
  const continueTarget = useContinueTarget();
  const reduceMotion = useReducedMotion();
  const [intro] = useState(() => !introPlayed && !reduceMotion);
  const { data: books, isLoading, isError, refetch } = useQuery<BookDto[]>({
    queryKey: qk.books,
    retry: 1,
  });
  const { data: read } = useQuery({
    queryKey: qk.read(),
    queryFn: () => fetchReadChapters(),
    enabled: authed,
  });

  const readByBook = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of read ?? []) acc[r.bookId] = (acc[r.bookId] ?? 0) + 1;
    return acc;
  }, [read]);

  useEffect(() => {
    if (books) introPlayed = true;
  }, [books]);
  // Po powrocie z księgi jej kafelek dostaje nazwę przejścia, zanim przeglądarka zrobi zrzut.
  useLayoutEffect(() => {
    if (books) nameBookTitle(null);
  }, [books]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books ?? [];
    return (books ?? []).filter(
      (b) =>
        b.namePl.toLowerCase().includes(q) ||
        b.shortPl.toLowerCase().includes(q) ||
        b.nameEn.toLowerCase().includes(q),
    );
  }, [books, query]);

  return (
    <div className="relative z-10 min-h-screen">
      <AmbientLight />
      <AppHeader />

      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="font-display text-xl font-bold leading-tight sm:text-xl">
          {intro ? <BlurWords text="Pismo w dwóch językach" stagger={0.07} /> : "Pismo w dwóch językach"}
        </h1>
        <motion.p
          className="mt-2 max-w-prose text-sm text-muted-foreground"
          initial={intro ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          Jedno tłumaczenie czytasz ciągiem, a drugie odsłaniasz kliknięciem w werset.
          Wybierz księgę, żeby zacząć.
        </motion.p>

        <div className="mt-6 space-y-4">
          {continueTarget ? <ContinueCard target={continueTarget} /> : continueTarget === null && <HeroDemo />}
          {authed && <TodayCards />}

          {!pending && !authed && (
            <p
              className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
              data-testid="text-login-hint"
            >
              Czytasz bez konta —{" "}
              <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                zaloguj się
              </Link>
              , żeby zapisywać postęp i ulubione wersety na wszystkich urządzeniach.
            </p>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj księgi — np. Psalmy, Jana, Genesis"
              className="pl-9"
              aria-label="Szukaj księgi"
              data-testid="input-book-search"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-[70px] rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="mt-10 text-center" role="alert">
            <p className="text-sm text-muted-foreground">Nie udało się wczytać listy ksiąg.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              Spróbuj ponownie
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground" data-testid="text-no-books">
            Brak księgi pasującej do „{query}".
          </p>
        ) : (
          <>
            <BookSection
              title="Stary Testament"
              books={filtered.filter((b) => b.testament === "OT")}
              readByBook={readByBook}
              intro={intro}
            />
            <BookSection
              title="Nowy Testament"
              books={filtered.filter((b) => b.testament === "NT")}
              readByBook={readByBook}
              intro={intro}
              introOffset={filtered.filter((b) => b.testament === "OT").length}
            />
          </>
        )}

        <p className="mt-12 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
          Teksty w domenie publicznej: World English Bible, Biblia Gdańska (1632), Biblia Jakuba Wujka (1599) i Reina-Valera (1909) — parę tłumaczeń wybierasz w czytniku.
          Kanon 66 ksiąg, 1189 rozdziałów.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <SupportButton variant="pill" />
          <span className="text-xs text-muted-foreground">Aplikacja jest darmowa. Jeśli Ci służy, możesz dobrowolnie ją wesprzeć.</span>
        </div>
      </main>
    </div>
  );
}
