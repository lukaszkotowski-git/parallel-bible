import { useRef, useState } from "react";
import { Link } from "wouter";
import { useQueries } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { ArrowRight, Pointer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchChapter, qk } from "@/lib/api";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { LANGUAGE_LABELS } from "@shared/translations";

const DEMO = { book: "John", chapter: 3, verse: 16, label: "J 3,16" };
const READ = "WEB";
const ALTS = ["BG", "WUJ", "RV"];

/** Sekundy: sam werset · „kliknięcie" · potem tłumaczenie odsłonięte i rotujące co HOLD. */
const READ_PAUSE = 2.2;
const HOLD = 4.8;

/**
 * Pokaz działania czytnika dla nowych osób: werset po angielsku, „kliknięcie", odsłonięcie
 * drugiego tłumaczenia, potem rotacja BG → Wujek → Reina-Valera. Całość prowadzi jedna oś czasu
 * GSAP (wejście, słowa wersetu, kursor z falą, rozwinięcie, pętla rotacji), a React trzyma tylko
 * stan treści: `open`, `tapped`, `index`. Tekst pochodzi z tego samego API co czytnik.
 * Najechanie/fokus wstrzymuje oś, kliknięcie w werset przejmuje sterowanie na stałe.
 */
export function HeroDemo() {
  const reduce = useReducedMotion();
  const results = useQueries({
    queries: ALTS.map((alt) => ({
      queryKey: qk.chapter(DEMO.book, DEMO.chapter, READ, alt),
      queryFn: () => fetchChapter(DEMO.book, DEMO.chapter, READ, alt),
      staleTime: Number.POSITIVE_INFINITY,
      retry: 1,
    })),
  });

  const samples = results.flatMap(({ data }) => {
    const verse = data?.verses.find((v) => v.v === DEMO.verse);
    if (!data || !verse?.alt || data.translations.alt.id === READ) return [];
    return [{ read: data.translations.read, alt: data.translations.alt, text: verse.text, altText: verse.alt }];
  });
  const loading = samples.length === 0 && results.some((r) => r.isLoading);
  const hasSamples = samples.length > 0;

  const [open, setOpen] = useState(!!reduce);
  const [tapped, setTapped] = useState(!!reduce);
  const [index, setIndex] = useState(0);

  const sectionRef = useRef<HTMLElement>(null);
  const verseRef = useRef<HTMLParagraphElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const splitRef = useRef<SplitText | null>(null);
  const manualRef = useRef(false);
  const countRef = useRef(0);
  countRef.current = samples.length;

  // Oś czasu: wejście sekcji → słowa wersetu → pauza → kursor „klika" → odsłonięcie → pętla rotacji.
  useGSAP(
    () => {
      const section = sectionRef.current;
      const verse = verseRef.current;
      const cursor = cursorRef.current;
      const ripple = rippleRef.current;
      if (reduce || !hasSamples || !section || !verse || !cursor || !ripple) return;
      const split = SplitText.create(verse, { type: "words" });
      splitRef.current = split;
      gsap.set(cursor, { opacity: 0, y: 14 });
      gsap.set(ripple, { scale: 0, opacity: 0 });
      const loop = gsap.timeline({ repeat: -1 });
      loop.to({}, { duration: HOLD }).call(() => setIndex((i) => i + 1));
      const tl = gsap.timeline();
      tl.from(section, { opacity: 0, y: 12, duration: 0.6, ease: "power3.out" }, 0.25)
        .from(split.words, { opacity: 0, filter: "blur(6px)", y: 6, duration: 0.5, ease: "power2.out", stagger: 0.018 }, 0.4)
        .to({}, { duration: READ_PAUSE })
        .call(() => setTapped(true))
        .to(cursor, { opacity: 1, y: 0, duration: 0.36, ease: "power2.out" })
        .to(cursor, { scale: 0.8, duration: 0.12 })
        .to(cursor, { scale: 1, duration: 0.12 })
        .fromTo(ripple, { scale: 0, opacity: 0.6 }, { scale: 2.6, opacity: 0, duration: 0.5, ease: "power2.out" }, "<")
        .call(() => setOpen(true))
        .to(cursor, { opacity: 0, duration: 0.25 }, "+=0.05")
        .add(loop);
      tlRef.current = tl;
      return () => {
        tl.kill();
        split.revert();
        splitRef.current = null;
      };
    },
    { dependencies: [reduce, hasSamples] },
  );

  // Rozwinięcie tłumaczenia: wysokość i przezroczystość prowadzi GSAP (bez grid-template-rows).
  useGSAP(
    () => {
      const el = revealRef.current;
      if (!el) return;
      if (reduce) {
        gsap.set(el, { height: "auto", opacity: 1 });
        return;
      }
      gsap.to(el, { height: open ? "auto" : 0, opacity: open ? 1 : 0, duration: 0.5, ease: "power2.out" });
    },
    { dependencies: [open, reduce, hasSamples] },
  );

  // Każde nowe tłumaczenie w rotacji wjeżdża słowo po słowie (rozmycie → ostrość).
  useGSAP(
    () => {
      const p = sectionRef.current?.querySelector<HTMLElement>('[data-hero-alt="active"] [data-hero-alt-text]');
      if (!p || !open || reduce) return;
      const split = SplitText.create(p, { type: "words" });
      gsap.from(split.words, {
        opacity: 0,
        filter: "blur(6px)",
        y: 4,
        duration: 0.5,
        ease: "power2.out",
        stagger: 0.025,
        delay: 0.15,
        onComplete: () => split.revert(),
      });
      return () => split.revert();
    },
    { dependencies: [index, open, reduce] },
  );

  /** Przejęcie sterowania przez użytkownika: zatrzymaj oś i pokaż stan końcowy wejścia. */
  const takeOver = () => {
    manualRef.current = true;
    tlRef.current?.kill();
    tlRef.current = null;
    splitRef.current?.revert();
    splitRef.current = null;
    if (sectionRef.current) gsap.set(sectionRef.current, { clearProps: "opacity,transform" });
    if (cursorRef.current) gsap.set(cursorRef.current, { opacity: 0 });
    setTapped(true);
  };
  const pause = () => tlRef.current?.pause();
  const resume = () => {
    if (!manualRef.current) tlRef.current?.resume();
  };

  if (!loading && samples.length === 0) return null;

  const active = samples.length ? index % samples.length : 0;
  const current = samples[active];

  const advance = () => {
    takeOver();
    if (open) setIndex((i) => i + 1);
    else setOpen(true);
  };

  return (
    <section
      ref={sectionRef}
      aria-label="Jak działa czytnik — przykład"
      className="relative overflow-hidden rounded-2xl border border-card-border bg-card p-4 sm:p-6"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      data-testid="hero-demo"
    >
      {/* Ciepła poświata w tle — wolno dryfuje, przy „ogranicz ruch" stoi. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 animate-glow-drift rounded-full bg-primary/15 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-20 h-56 w-56 animate-glow-drift rounded-full bg-read-marker/10 blur-3xl [animation-delay:-7s]"
      />

      <div className="relative">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-wide">{DEMO.label}</span>
          {current && (
            <span className="rounded-full border border-border bg-background/60 px-2 py-0.5">
              {current.read.shortName} · {LANGUAGE_LABELS[current.read.language] ?? current.read.language}
            </span>
          )}
        </div>

        {loading || !current ? (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-11/12" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : (
          // biome-ignore lint/a11y/useSemanticElements: w środku są <p> — <button> dopuszcza tylko phrasing content
          <div
            role="button"
            tabIndex={0}
            aria-label={open ? "Pokaż kolejne tłumaczenie" : "Pokaż tłumaczenie wersetu"}
            onClick={advance}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                advance();
              }
            }}
            className={cn(
              "relative -mx-2 mt-3 cursor-pointer rounded-lg px-2 py-2 transition-colors duration-300 hover:bg-accent/50",
              (tapped || open) && "bg-accent/40",
            )}
          >
            <p ref={verseRef} className="verse-en" lang={current.read.language}>
              {current.text}
            </p>

            {/* „Kursor" i fala kliknięcia — cały ruch prowadzi oś czasu GSAP (start: niewidoczne). */}
            <span
              ref={cursorRef}
              aria-hidden="true"
              className="pointer-events-none absolute bottom-1 right-6 text-primary opacity-0"
            >
              <span ref={rippleRef} className="absolute left-1 top-0 h-5 w-5 rounded-full bg-primary/40" />
              <Pointer className="relative h-6 w-6 drop-shadow-sm" />
            </span>

            {/* Rozwijanie przez grid-template-rows 0fr → 1fr (płynna wysokość bez mierzenia). Wszystkie
                tłumaczenia leżą w jednej komórce siatki, więc wysokość = najdłuższe — rotacja nie skacze. */}
            <div ref={revealRef} className="h-0 overflow-hidden opacity-0">
              <div>
                <div className="grid pt-3">
                  {samples.map((s, i) => (
                    <div
                      key={s.alt.id}
                      className={cn(
                        "[grid-area:1/1] transition-[opacity,visibility] duration-300",
                        i === active ? "visible opacity-100" : "invisible opacity-0",
                      )}
                      aria-hidden={i !== active || !open}
                      data-hero-alt={i === active ? "active" : undefined}
                    >
                      <p className="mb-1.5 text-xs font-medium text-primary">
                        {s.alt.name}
                        {s.alt.year ? ` · ${s.alt.year}` : ""}
                      </p>
                      <p lang={s.alt.language} data-hero-alt-text className="verse-pl border-l-2 border-primary/40 pl-3">
                        {s.altText}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-0.5">
            {samples.map((s, i) => (
              <button
                key={s.alt.id}
                type="button"
                aria-label={`Pokaż: ${s.alt.name}`}
                aria-pressed={open && i === active}
                onClick={() => {
                  takeOver();
                  setOpen(true);
                  setIndex(i);
                }}
                className="group/dot flex h-6 items-center px-0.5"
              >
                <span
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-500",
                    open && i === active
                      ? "w-6 bg-primary"
                      : "w-1.5 bg-muted-foreground/30 group-hover/dot:bg-muted-foreground/60",
                  )}
                />
              </button>
            ))}
            <span className="ml-2 text-xs text-muted-foreground">Kliknij werset, by zmienić tłumaczenie</span>
          </div>
          <Link
            href={`/czytaj/${DEMO.book}/${DEMO.chapter}`}
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary"
            data-testid="link-hero-start"
          >
            Zacznij od Ewangelii Jana
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
