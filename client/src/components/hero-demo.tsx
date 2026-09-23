import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQueries } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Pointer } from "lucide-react";
import { BlurWords } from "@/components/motion-text";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchChapter, qk } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LANGUAGE_LABELS } from "@shared/translations";

const DEMO = { book: "John", chapter: 3, verse: 16, label: "J 3,16" };
const READ = "WEB";
const ALTS = ["BG", "WUJ", "RV"];

/** read: widać sam werset · tap: „kursor" klika · open: odsłonięte tłumaczenie (rotuje co HOLD_MS). */
type Phase = "read" | "tap" | "open";
const READ_MS = 2200;
const TAP_MS = 900;
const HOLD_MS = 4800;

/**
 * Pokaz działania czytnika dla nowych osób: werset po angielsku, „kliknięcie", odsłonięcie
 * drugiego tłumaczenia, potem rotacja BG → Wujek → Reina-Valera. Tekst pochodzi z tego samego
 * API co czytnik (klucz zapytania też ten sam, więc J 3 otwiera się potem z cache).
 * Najechanie/fokus wstrzymuje rotację; kliknięcie w werset przejmuje sterowanie na stałe.
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

  const [phase, setPhase] = useState<Phase>(reduce ? "open" : "read");
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (reduce || hovered || manual || samples.length === 0) return;
    const ms = phase === "read" ? READ_MS : phase === "tap" ? TAP_MS : HOLD_MS;
    const t = setTimeout(() => {
      if (phase === "read") setPhase("tap");
      else if (phase === "tap") setPhase("open");
      else setIndex((i) => i + 1);
    }, ms);
    return () => clearTimeout(t);
  }, [phase, index, hovered, manual, reduce, samples.length]);

  if (!loading && samples.length === 0) return null;

  const active = samples.length ? index % samples.length : 0;
  const current = samples[active];
  const open = phase === "open";

  const advance = () => {
    setManual(true);
    if (open) setIndex((i) => i + 1);
    else setPhase("open");
  };

  return (
    <motion.section
      aria-label="Jak działa czytnik — przykład"
      className="relative overflow-hidden rounded-2xl border border-card-border bg-card p-4 sm:p-6"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
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
              (phase === "tap" || open) && "bg-accent/40",
            )}
          >
            <p className="verse-en" lang={current.read.language}>
              <BlurWords text={current.text} delay={0.4} stagger={0.018} />
            </p>

            <AnimatePresence>
              {phase === "tap" && (
                <motion.span
                  key="tap"
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-1 right-6 text-primary"
                  initial={{ opacity: 0, y: 14, scale: 1 }}
                  animate={{ opacity: [0, 1, 1, 1], y: [14, 0, 0, 0], scale: [1, 1, 0.8, 1] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, times: [0, 0.45, 0.7, 1] }}
                >
                  <motion.span
                    className="absolute left-1 top-0 h-5 w-5 rounded-full bg-primary/40"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 0, 2.6], opacity: [0, 0.6, 0] }}
                    transition={{ duration: 0.8, times: [0, 0.6, 1] }}
                  />
                  <Pointer className="relative h-6 w-6 drop-shadow-sm" />
                </motion.span>
              )}
            </AnimatePresence>

            {/* Rozwijanie przez grid-template-rows 0fr → 1fr (płynna wysokość bez mierzenia). Wszystkie
                tłumaczenia leżą w jednej komórce siatki, więc wysokość = najdłuższe — rotacja nie skacze. */}
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-500 ease-out",
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="grid pt-3">
                  {samples.map((s, i) => (
                    <div
                      key={s.alt.id}
                      className={cn(
                        "[grid-area:1/1] transition-[opacity,visibility] duration-300",
                        i === active ? "visible opacity-100" : "invisible opacity-0",
                      )}
                      aria-hidden={i !== active || !open}
                    >
                      <p className="mb-1.5 text-xs font-medium text-primary">
                        {s.alt.name}
                        {s.alt.year ? ` · ${s.alt.year}` : ""}
                      </p>
                      <p lang={s.alt.language} className="verse-pl border-l-2 border-primary/40 pl-3">
                        {i === active && open ? (
                          <BlurWords key={index} text={s.altText} delay={0.15} stagger={0.025} />
                        ) : (
                          s.altText
                        )}
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
                  setManual(true);
                  setPhase("open");
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
    </motion.section>
  );
}
