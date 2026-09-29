import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Link, useLocation, useParams } from "wouter";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { AppHeader, useAuthed } from "@/components/app-header";
import { ChapterCommentary } from "@/components/chapter-commentary";
import { SupportNudge } from "@/components/support-nudge";
import { ReadingSettingsPopover } from "@/components/reading-settings-popover";
import { VerseRow } from "@/components/verse-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { gsap, useGSAP } from "@/lib/gsap";
import { announceReward } from "@/lib/rewards";
import {
  addFavorite,
  addLearnCard,
  checkVerse,
  fetchChapter,
  fetchProgress,
  invalidateLearn,
  removeLearnCard,
  fetchFavorites,
  fetchMarks,
  fetchReadChapters,
  invalidateMarks,
  invalidateUserState,
  markRead,
  qk,
  removeFavorite,
  saveHighlight,
  saveNote,
  savePosition,
  unmarkRead,
  type ChapterDto,
  type ChapterMarksDto,
  type HighlightColor,
} from "@/lib/api";
import { saveLocalPosition } from "@/lib/last-position";
import { useTranslations } from "@/lib/translations";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { BOOK_TITLE_VT } from "@/lib/view-transition";

const HINT_KEY = "pb-reveal-count";
const HINT_REVEALS = 3;

function revealCount() {
  try {
    return Number(localStorage.getItem(HINT_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Podpowiedź „dotknij wersetu" żyje, dopóki czytelnik nie odsłoni tłumaczenia trzy razy (rozwinięcie
 * wszystkich liczy się jak komplet). Znika dopiero przy kolejnym rozdziale (`retire`) — zniknięcie pod
 * palcem przesunęłoby cały tekst o wysokość akapitu.
 */
function useRevealHint() {
  const [showHint, setShowHint] = useState(() => revealCount() < HINT_REVEALS);
  const markRevealed = useCallback((count = 1) => {
    try {
      localStorage.setItem(HINT_KEY, String(revealCount() + count));
    } catch {
      /* tryb prywatny — podpowiedź wróci po odświeżeniu */
    }
  }, []);
  const retire = useCallback(() => setShowHint(revealCount() < HINT_REVEALS), []);
  return { showHint, markRevealed, retire };
}

export default function ReadPage() {
  const params = useParams<{ book: string; chapter: string }>();
  const bookId = params.book ?? "";
  const chapter = Number(params.chapter ?? 1);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { authed } = useAuthed();
  const { showHint, markRevealed, retire } = useRevealHint();
  const lastLoginPrompt = useRef(0);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const [openVerses, setOpenVerses] = useState<Set<number>>(new Set());
  // „Rozwiń/zwiń wszystkie": fala animacji od werseta najbliższego środka ekranu.
  const [cascadeAnchor, setCascadeAnchor] = useState<number | null>(null);
  const cascadeTimer = useRef<ReturnType<typeof setTimeout>>();
  // Okno „jak Ci się podoba aplikacja?" — pokazuje je serwer w odpowiedzi na zapis rozdziału.
  const [nudge, setNudge] = useState<{ chapters: number } | null>(null);

  const { read, alt, readLang, altLang } = useTranslations();
  const { data, isLoading, isPlaceholderData, isError, error, refetch } = useQuery<ChapterDto>({
    queryKey: qk.chapter(bookId, chapter, read, alt),
    queryFn: () => fetchChapter(bookId, chapter, read, alt),
    placeholderData: keepPreviousData, // przy zmianie tłumaczeń stary tekst zostaje do czasu nowego
    retry: 1, // jedna ponowna próba: chwilowy brak sieci nie powinien od razu pokazywać błędu
  });

  // `keepPreviousData` ma tylko podtrzymać tekst przy zmianie pary tłumaczeń. Gdy pokazywany jest INNY
  // rozdział niż w adresie, nie wolno na nim niczego zapisywać (numery wersetów należą do starego), więc
  // traktujemy to jak wczytywanie.
  const wrongChapter = !!data && (data.book.id !== bookId || data.book.chapter !== chapter);
  const loading = isLoading || !data || wrongChapter;

  // Sąsiednie rozdziały ładujemy z wyprzedzeniem, żeby „Następny" był natychmiastowy.
  // Odpowiedzi są niezmienne i cache'owane, więc koszt to jedno lekkie zapytanie.
  const prevRef = data?.nav.prev;
  const nextRef = data?.nav.next;
  useEffect(() => {
    for (const ref of [nextRef, prevRef]) {
      if (ref) {
        queryClient.prefetchQuery({
          queryKey: qk.chapter(ref.book, ref.chapter, read, alt),
          queryFn: () => fetchChapter(ref.book, ref.chapter, read, alt),
        });
      }
    }
  }, [prevRef?.book, prevRef?.chapter, nextRef?.book, nextRef?.chapter, read, alt]);

  // Trzymamy postęp w cache'u, żeby po akcji dało się wykryć awans na wyższy poziom.
  useQuery({ queryKey: qk.progress, queryFn: fetchProgress, enabled: authed });

  const { data: marks } = useQuery({
    queryKey: qk.marks(bookId, chapter),
    queryFn: () => fetchMarks(bookId, chapter),
    enabled: authed,
  });
  const highlightByVerse = useMemo(
    () => new Map((marks?.highlights ?? []).map((h) => [h.verse, h.color])),
    [marks],
  );
  const checkByVerse = useMemo(
    () => new Map((marks?.checks ?? []).map((c) => [c.verse, c.understood])),
    [marks],
  );
  const cardSet = useMemo(() => new Set(marks?.cards ?? []), [marks]);
  const noteByVerse = useMemo(
    () => new Map((marks?.notes ?? []).map((n) => [n.verse, n.text])),
    [marks],
  );

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

  // Czas spędzony na rozdziale (tylko gdy karta jest widoczna) — serwer na jego podstawie
  // decyduje, czy czytanie liczy się do serii, celu dziennego i punktów.
  const secondsRef = useRef(0);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") secondsRef.current += 1;
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Nowy rozdział: zwiń odsłonięte tłumaczenia i zapamiętaj ostatnią pozycję czytania lokalnie.
  useEffect(() => {
    setOpenVerses(new Set());
    secondsRef.current = 0;
    window.scrollTo({ top: 0 });
    retire();
    if (bookId && chapter) saveLocalPosition({ bookId, chapter });
  }, [bookId, chapter, retire]);

  // Pozycja na koncie — osobno, żeby dojście sesji po załadowaniu strony nie zwijało wersetów,
  // nie zerowało czasu czytania ani nie przewijało na górę.
  useEffect(() => {
    if (authed && bookId && chapter) {
      savePosition(bookId, chapter)
        .then(() => invalidateUserState())
        .catch(() => undefined);
    }
  }, [authed, bookId, chapter]);

  // Czytnik ekranu i klawiatura: po zmianie rozdziału fokus wraca na tytuł, a tytuł karty się zmienia.
  const loadedTitle = !loading && data ? `${data.book.namePl} ${data.book.chapter}` : null;
  useEffect(() => {
    if (!loadedTitle) return;
    document.title = `${loadedTitle} — Parallel Bible`;
    titleRef.current?.focus({ preventScroll: true });
  }, [loadedTitle]);

  const reduceMotion = useReducedMotion();
  const versesRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Otwarcie rozdziału: wersety w oknie wchodzą kolejno (fade + lekki przesuw), pozostałe dopiero gdy
  // się do nich dojedzie. Wyzwalaczem jest IntersectionObserver, nie pozycje policzone z góry — te
  // rozjeżdżają się, gdy odsłonięte tłumaczenia zmieniają wysokość wersetów powyżej.
  // Tytułu `h1` nie animujemy (ma view-transition-name), a przy reduced motion nic się nie chowa.
  useGSAP(
    () => {
      const root = versesRef.current;
      if (!root || !loadedTitle || reduceMotion) return;
      const rows = gsap.utils.toArray<HTMLElement>("[data-verse-row]", root);
      const inView = rows.filter((r) => r.getBoundingClientRect().top < window.innerHeight);
      const rest = rows.filter((r) => !inView.includes(r));
      const show = { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", clearProps: "opacity,transform" };
      gsap.set(rows, { opacity: 0, y: 14 });
      gsap.to(inView, { ...show, stagger: { each: 0.05, amount: 0.6 }, delay: 0.05 });
      const io = new IntersectionObserver(
        (entries) => {
          const entering = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
          if (!entering.length) return;
          for (const el of entering) io.unobserve(el);
          gsap.to(entering, { ...show, stagger: 0.05 });
        },
        { rootMargin: "0px 0px -6% 0px" },
      );
      for (const el of rest) io.observe(el);
      // Bezpiecznik: gdyby obserwator nie zadziałał, po kilku sekundach nic nie zostaje ukryte.
      const failsafe = setTimeout(() => {
        io.disconnect();
        gsap.set(rest, { clearProps: "opacity,transform" });
      }, 8000);
      return () => {
        clearTimeout(failsafe);
        io.disconnect();
        gsap.set(rows, { clearProps: "opacity,transform" });
      };
    },
    { dependencies: [loadedTitle, reduceMotion] },
  );

  // Postęp w rozdziale: cienka bursztynowa linia u góry okna, liczona na żywo z położenia listy wersetów
  // (więc poprawna także po rozwinięciu tłumaczeń). Przy reduced motion bez wygładzania.
  useGSAP(
    () => {
      const bar = progressRef.current;
      const root = versesRef.current;
      if (!bar || !root || !loadedTitle) return;
      const setX = gsap.quickTo(bar, "scaleX", { duration: reduceMotion ? 0 : 0.25, ease: "power2.out" });
      const update = () => {
        const r = root.getBoundingClientRect();
        const done = window.innerHeight * 0.6 - r.top;
        setX(Math.min(1, Math.max(0, r.height > 0 ? done / r.height : 0)));
      };
      update();
      window.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      return () => {
        window.removeEventListener("scroll", update);
        window.removeEventListener("resize", update);
        gsap.set(bar, { scaleX: 0 });
      };
    },
    { dependencies: [loadedTitle, reduceMotion] },
  );

  const readMutation = useMutation({
    // `book` i `seconds` przekazujemy jawnie: mutationFn rusza asynchronicznie, a po przejściu dalej
    // adres i licznik czasu dotyczą już następnego rozdziału (inaczej „Cofnij" trafiłoby w złą księgę).
    mutationFn: async ({ mark, book, ch, seconds }: { mark: boolean; book: string; ch: number; seconds?: number }) =>
      mark ? markRead(book, ch, seconds ?? 0) : unmarkRead(book, ch),
    onSuccess: (res) => {
      invalidateUserState();
      if (res) {
        announceReward(res);
        if ("nudge" in res && res.nudge) setNudge(res.nudge);
      }
    },
  });

  /** Cofnięcie oznaczenia; komunikat dopiero po odpowiedzi serwera, błąd nie jest cichy. */
  const unmarkChapter = (book: string, ch: number, message = "Cofnięto oznaczenie") =>
    readMutation.mutate(
      { mark: false, book, ch },
      {
        onSuccess: () => toast({ title: message, duration: 4000 }),
        onError: () => toast({ title: "Nie udało się cofnąć oznaczenia", variant: "destructive", duration: 4000 }),
      },
    );

  const allOpen = !!data && data.verses.length > 0 && openVerses.size === data.verses.length;

  const toggleAll = () => {
    if (!data) return;
    if (!allOpen) markRevealed(HINT_REVEALS);
    // Anchor = werset najbliżej środka okna: od niego odsłonięcie rozchodzi się w górę i w dół.
    let anchor = data.verses[0]?.v ?? 1;
    let best = Number.POSITIVE_INFINITY;
    for (const v of data.verses) {
      const r = document.querySelector(`[data-testid="verse-${v.v}"]`)?.getBoundingClientRect();
      if (!r) continue;
      const d = Math.abs(r.top + r.height / 2 - window.innerHeight / 2);
      if (d < best) {
        best = d;
        anchor = v.v;
      }
    }
    setCascadeAnchor(anchor);
    clearTimeout(cascadeTimer.current);
    cascadeTimer.current = setTimeout(() => setCascadeAnchor(null), 2500);
    setOpenVerses(allOpen ? new Set() : new Set(data.verses.map((v) => v.v)));
  };

  const toggleVerse = (v: number) => {
    if (!openVerses.has(v)) markRevealed();
    setCascadeAnchor(null);
    setOpenVerses((prev) => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  };

  /** Zaproszenie do logowania zamiast cichego 401 z API. */
  const promptLogin = (what: string) => {
    // Seria stuknięć w gwiazdki nie zasypuje ekranu tym samym komunikatem.
    if (Date.now() - lastLoginPrompt.current < 20_000) return;
    lastLoginPrompt.current = Date.now();
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
    try {
      if (favoriteSet.has(v)) await removeFavorite(bookId, chapter, v);
      else await addFavorite(bookId, chapter, v);
    } catch {
      toast({ title: "Nie udało się zapisać ulubionego", variant: "destructive", duration: 4000 });
    }
    invalidateUserState();
  };

  // Zapis z optymistyczną aktualizacją cache — kolor/notatka pojawiają się od razu,
  // a invalidate na końcu uzgadnia z serwerem (także po błędzie).
  const updateMarks = (fn: (m: ChapterMarksDto) => ChapterMarksDto) =>
    queryClient.setQueryData<ChapterMarksDto>(qk.marks(bookId, chapter), (old) =>
      fn(old ?? { highlights: [], notes: [], checks: [], cards: [] }),
    );

  const setHighlight = async (v: number, color: HighlightColor | null) => {
    if (!authed) return promptLogin("Wyróżnienia");
    updateMarks((m) => ({
      ...m,
      highlights: [
        ...m.highlights.filter((h) => h.verse !== v),
        ...(color ? [{ verse: v, color }] : []),
      ],
    }));
    try {
      announceReward(await saveHighlight(bookId, chapter, v, color));
    } catch {
      toast({ title: "Nie udało się zapisać wyróżnienia", variant: "destructive", duration: 4000 });
    }
    invalidateMarks();
  };

  const setNote = async (v: number, text: string) => {
    if (!authed) return promptLogin("Notatki");
    const trimmed = text.trim();
    updateMarks((m) => ({
      ...m,
      notes: [
        ...m.notes.filter((n) => n.verse !== v),
        ...(trimmed ? [{ verse: v, text: trimmed, updatedAt: new Date().toISOString() }] : []),
      ],
    }));
    try {
      announceReward(await saveNote(bookId, chapter, v, text));
    } catch {
      toast({ title: "Nie udało się zapisać notatki", variant: "destructive", duration: 4000 });
    }
    invalidateMarks();
  };

  /** Odpowiedź po odsłonięciu tłumaczenia: „zrozumiałem" albo „musiałem sprawdzić" (to drugie dodaje fiszkę). */
  const answerCheck = async (v: number, understood: boolean) => {
    updateMarks((m) => ({
      ...m,
      checks: [...m.checks.filter((c) => c.verse !== v), { verse: v, understood }],
      cards: !understood && !m.cards.includes(v) ? [...m.cards, v] : m.cards,
    }));
    try {
      const res = await checkVerse({ bookId, chapter, verse: v }, understood);
      announceReward(res);
      if (res.addedToDeck) toast({ title: "Dodano do powtórek", description: `Werset ${v} wróci w trybie nauki.`, duration: 3000 });
    } catch {
      toast({ title: "Nie udało się zapisać odpowiedzi", variant: "destructive", duration: 4000 });
    }
    invalidateLearn();
  };

  const toggleCard = async (v: number) => {
    if (!authed) return promptLogin("Powtórki");
    const inDeck = cardSet.has(v);
    updateMarks((m) => ({ ...m, cards: inDeck ? m.cards.filter((x) => x !== v) : [...m.cards, v] }));
    try {
      if (inDeck) await removeLearnCard({ bookId, chapter, verse: v });
      else announceReward(await addLearnCard({ bookId, chapter, verse: v }));
    } catch {
      toast({ title: "Nie udało się zapisać", variant: "destructive", duration: 4000 });
    }
    invalidateLearn();
  };

  /** Zapis postępu z komunikatem i cofnięciem (6 s, zawsze da się zamknąć krzyżykiem). Zwraca, czy się udał. */
  const saveProgress = async (book: string, ch: number, description: string) => {
    let counted = true;
    try {
      const res = await readMutation.mutateAsync({ mark: true, book, ch, seconds: secondsRef.current });
      if (res && "counted" in res) counted = res.counted;
    } catch {
      toast({ title: "Nie udało się zapisać postępu", variant: "destructive", duration: 4000 });
      return false;
    }
    toast({
      title: "Zapisano postęp",
      // Krótkie „odhaczenie" zapisuje postęp, ale nie liczy się do serii i punktów.
      description: counted ? description : `${description} Zbyt krótko, by liczyło się do serii i punktów.`,
      duration: 6000,
      action: (
        <ToastAction
          altText="Cofnij zapis postępu"
          onClick={() => unmarkChapter(book, ch)}
          data-testid="button-undo-progress"
        >
          Cofnij
        </ToastAction>
      ),
    });
    return true;
  };

  /** Jedyny przycisk „dalej", który zapisuje: zaznacza rozdział jako przeczytany i przechodzi do następnego. */
  const finishChapter = async () => {
    if (!data || loading) return;
    const next = data.nav.next;
    const saved = await saveProgress(data.book.id, data.book.chapter, `${data.book.namePl} ${data.book.chapter} oznaczony jako przeczytany.`);
    if (saved && next) navigate(`/czytaj/${next.book}/${next.chapter}`);
  };

  /** Zwykłe „Następny" tylko nawiguje (rozdział już przeczytany albo brak konta). */
  const goNext = () => {
    if (!data?.nav.next) return;
    navigate(`/czytaj/${data.nav.next.book}/${data.nav.next.chapter}`);
  };

  if (isError) {
    // 404 = zły adres; wszystko inne (sieć, 5xx) da się ponowić.
    const notFound = error instanceof Error && error.message.startsWith("404");
    return (
      <div className="relative z-10 min-h-screen">
        <AppHeader />
        <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h1 className="font-display text-xl font-bold">
            {notFound ? "Nie znaleziono rozdziału" : "Nie udało się wczytać rozdziału"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {notFound
              ? "Sprawdź adres albo wróć do wyboru księgi."
              : "Sprawdź połączenie z internetem i spróbuj ponownie."}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            {!notFound && (
              <Button onClick={() => refetch()} data-testid="button-retry">
                Spróbuj ponownie
              </Button>
            )}
            <Button asChild variant={notFound ? "default" : "outline"}>
              <Link href="/">Wybór księgi</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const canFinish = authed && !isRead;
  const toggleAllButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleAll}
      data-testid="button-toggle-all-pl"
    >
      {allOpen ? <ChevronsDownUp className="mr-1.5 h-4 w-4" /> : <ChevronsUpDown className="mr-1.5 h-4 w-4" />}
      {allOpen ? "Zwiń wszystkie tłumaczenia" : "Rozwiń wszystkie tłumaczenia"}
    </Button>
  );
  const SKELETON_ROWS = ["h-14", "h-20", "h-16", "h-24", "h-14", "h-20", "h-16", "h-14"];

  return (
    <div className="relative z-10 min-h-screen pb-[calc(7rem+env(safe-area-inset-bottom))] sm:pb-12">
      <div
        ref={progressRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-primary"
        style={{ transform: "scaleX(0)" }}
      />
      <AppHeader reading />
      {nudge && <SupportNudge chapters={nudge.chapters} onClose={() => setNudge(null)} />}

      <main
        id="main"
        className="mx-auto px-4 pt-3 sm:px-6"
        style={{ maxWidth: "var(--reading-width, 48rem)" }}
      >
        <Link
          href={`/ksiega/${bookId}`}
          aria-label={data && !wrongChapter ? `Rozdziały: ${data.book.namePl}` : undefined}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md pr-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          data-testid="link-back-chapters"
        >
          <ArrowLeft className="h-4 w-4" /> Rozdziały
        </Link>

        {loading || !data ? (
          <div className="mt-3 space-y-4" role="status" aria-label="Wczytywanie rozdziału">
            <Skeleton className="h-10 w-64" />
            {SKELETON_ROWS.map((h, i) => (
              <Skeleton key={i} className={cn("w-full rounded-lg", h)} />
            ))}
          </div>
        ) : (
          <>
            <div className="mt-1 border-b border-border pb-5">
              <h1
                ref={titleRef}
                tabIndex={-1}
                className="w-fit font-display text-3xl font-bold leading-tight focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-4xl"
                style={{ viewTransitionName: BOOK_TITLE_VT }}
              >
                {data.book.namePl} {data.book.chapter}
              </h1>
              {showHint && (
                <p className="mt-2 text-balance text-sm text-muted-foreground" data-testid="text-reveal-hint">
                  Dotknij werset, by zobaczyć: {data.translations.alt.name}.
                </p>
              )}

              {/* Na telefonie nad tekstem nie ma kontrolek: „rozwiń wszystkie" i widok są w dolnym pasku. */}
              <div className="mt-4 flex flex-wrap items-center gap-2 max-sm:hidden">
                {toggleAllButton}

                <ReadingSettingsPopover
                  pair={`${data.translations.read.shortName} → ${data.translations.alt.shortName}`}
                  pairLong={`${data.translations.read.name} → ${data.translations.alt.name}`}
                />
              </div>
            </div>

            <div
              ref={versesRef}
              className={cn("py-4 transition-opacity duration-200", isPlaceholderData && "opacity-60")}
              aria-busy={isPlaceholderData}
            >
              {data.verses.map((verse, i) => (
                <VerseRow
                  key={`${data.book.id}-${data.book.chapter}-${verse.v}`}
                  verse={verse}
                  hint={showHint && i === 0}
                  readLang={readLang}
                  altLang={altLang}
                  open={openVerses.has(verse.v)}
                  revealDelay={cascadeAnchor === null ? 0 : Math.min(Math.abs(verse.v - cascadeAnchor) * 0.045, 1)}
                  favorite={favoriteSet.has(verse.v)}
                  highlight={highlightByVerse.get(verse.v)}
                  note={noteByVerse.get(verse.v)}
                  onToggle={() => toggleVerse(verse.v)}
                  onToggleFavorite={() => toggleFavorite(verse.v)}
                  learn={authed ? { checked: checkByVerse.get(verse.v), inDeck: cardSet.has(verse.v) } : undefined}
                  onCheck={(u) => answerCheck(verse.v, u)}
                  onToggleCard={() => toggleCard(verse.v)}
                  onHighlight={(c) => setHighlight(verse.v, c)}
                  onSaveNote={(t) => setNote(verse.v, t)}
                  locked={!authed}
                />
              ))}

              {data.extraAlt.length > 0 && (
                <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/40 p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Dodatkowe wersety: {data.translations.alt.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Numeracja przekładów nie zawsze się pokrywa — te wersety nie mają odpowiednika w {data.translations.read.shortName}.
                  </p>
                  {data.extraAlt.map((e) => (
                    <p key={e.v} lang={altLang} className="verse-pl mt-3">
                      <span className="mr-2 not-italic text-verse-number">{e.v}</span>
                      {e.alt}
                    </p>
                  ))}
                </div>
              )}

              {data.commentary && (
                <ChapterCommentary
                  key={`${data.book.id}-${data.book.chapter}`}
                  commentary={data.commentary}
                  readLang={readLang}
                  altLang={altLang}
                />
              )}

              {/* Stan zakończenia — sam zapis robi przycisk w dolnej nawigacji („Zakończ i dalej"). */}
              {authed && isRead && (
                <section
                  aria-label="Koniec rozdziału"
                  className="mt-8 flex flex-col items-center gap-2 border-t border-border pt-6 text-center"
                >
                  <ChapterDone />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="max-sm:min-h-11"
                    onClick={() => unmarkChapter(data.book.id, data.book.chapter)}
                    data-testid="button-unmark-read"
                  >
                    Cofnij oznaczenie
                  </Button>
                </section>
              )}
            </div>

            {/* Jedna nawigacja: przyklejona do dołu na mobile, w treści na desktopie */}
            <nav
              aria-label="Nawigacja po rozdziałach"
              className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-1 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:static sm:gap-3 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-5 sm:backdrop-blur-none"
            >
              <ChapterNavButtons
                data={data}
                canFinish={canFinish}
                onNext={goNext}
                onFinish={finishChapter}
                allOpen={allOpen}
                onToggleAll={toggleAll}
              />
            </nav>
          </>
        )}
      </main>
    </div>
  );
}

/** „Rozdział przeczytany": ptaszek rysuje się i krótko rozświetla się, gdy czytelnik dojedzie do końca. */
function ChapterDone() {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduceMotion = useReducedMotion();
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reduceMotion) return;
      const shapes = el.querySelectorAll("svg *");
      const ring = el.querySelector("[data-done-ring]");
      gsap.set(shapes, { drawSVG: "0%" });
      const io = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          io.disconnect();
          gsap
            .timeline()
            .fromTo(shapes, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, ease: "power2.out" }, 0.05)
            .fromTo(ring, { scale: 0.5, opacity: 0.9 }, { scale: 2.4, opacity: 0, duration: 0.9, ease: "power2.out" }, 0);
        },
        { threshold: 0.6 },
      );
      io.observe(el);
      // Bezpiecznik: ptaszek nigdy nie może zostać niewidoczny.
      const failsafe = setTimeout(() => gsap.set(shapes, { drawSVG: "100%" }), 6000);
      return () => {
        io.disconnect();
        clearTimeout(failsafe);
      };
    },
    { scope: ref, dependencies: [reduceMotion] },
  );
  return (
    <p ref={ref} className="flex items-center gap-2 font-display text-lg text-read-marker">
      <span className="relative inline-flex h-5 w-5 items-center justify-center">
        <span data-done-ring aria-hidden="true" className="absolute inset-0 rounded-full bg-read-marker/30 opacity-0" />
        <Check className="relative h-5 w-5" aria-hidden="true" />
      </span>
      Rozdział przeczytany
    </p>
  );
}

function ChapterNavButtons({
  data,
  canFinish,
  onNext,
  onFinish,
  allOpen,
  onToggleAll,
}: {
  data: ChapterDto;
  /** Zalogowany i rozdział jeszcze nieprzeczytany: główny przycisk zapisuje postęp. */
  canFinish: boolean;
  onNext: () => void;
  onFinish: () => void;
  allOpen: boolean;
  onToggleAll: () => void;
}) {
  const hasNext = !!data.nav.next;
  // Telefon: „Poprzedni" to sama strzałka 44 px, a główny przycisk dostaje całą resztę (mieści się przy 320 px).
  const prevSide = "w-11 flex-none px-0 sm:w-auto sm:px-4";
  const nextSide = "min-w-0 flex-1 max-sm:min-h-11 max-[380px]:px-2 sm:flex-none";
  return (
    <>
      {data.nav.prev ? (
        <Button asChild variant="ghost" className={cn(prevSide, "max-sm:h-11")} data-testid="link-prev-chapter">
          <Link href={`/czytaj/${data.nav.prev.book}/${data.nav.prev.chapter}`} aria-label="Poprzedni rozdział">
            <ChevronLeft className="h-4 w-4 sm:mr-1" />
            <span className="max-sm:sr-only">Poprzedni</span>
          </Link>
        </Button>
      ) : (
        <span className={cn(prevSide, "max-sm:w-11")} />
      )}

      <div className="flex shrink-0 items-center">
        <Link
          href={`/ksiega/${data.book.id}`}
          aria-label={`Rozdział ${data.book.chapter} z ${data.book.totalChapters} — wybierz rozdział`}
          className="inline-flex min-h-11 items-center rounded-md px-2 text-xs tabular-nums text-muted-foreground underline decoration-muted-foreground/40 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground sm:min-h-8 sm:px-3"
          data-testid="link-chapter-index"
        >
          {data.book.chapter} / {data.book.totalChapters}
        </Link>
        {/* Na telefonie to wejście do rozwijania tłumaczeń i widoku: nagłówek się chowa, nad tekstem nic nie ma. */}
        <div className="flex items-center sm:hidden">
          <Button
            variant="ghost"
            className="h-11 min-w-11 flex-col gap-0.5 px-1 text-[0.625rem] font-medium leading-none text-muted-foreground"
            onClick={onToggleAll}
            aria-label={allOpen ? "Zwiń wszystkie tłumaczenia" : "Rozwiń wszystkie tłumaczenia"}
            data-testid="button-toggle-all-pl-compact"
          >
            {allOpen ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
            {allOpen ? "Zwiń" : "Rozwiń"}
          </Button>
          <ReadingSettingsPopover compact />
        </div>
      </div>

      {canFinish || hasNext ? (
        <Button
          onClick={canFinish ? onFinish : onNext}
          className={nextSide}
          aria-label={canFinish ? (hasNext ? "Zakończ rozdział i przejdź dalej" : "Zakończ rozdział") : "Następny rozdział"}
          data-testid={canFinish ? "button-mark-read" : "button-next-chapter"}
        >
          {canFinish ? (
            <>
              <Check className="mr-1.5 h-4 w-4 max-[380px]:mr-1" />
              {hasNext ? (
                <>
                  <span className="max-[380px]:hidden">Zakończ i dalej</span>
                  <span className="hidden max-[380px]:inline">Dalej</span>
                </>
              ) : (
                "Zakończ rozdział"
              )}
            </>
          ) : (
            <>
              Następny <ChevronRight className="ml-1 h-4 w-4 max-[380px]:hidden" />
            </>
          )}
        </Button>
      ) : (
        <span className={nextSide} />
      )}
    </>
  );
}
