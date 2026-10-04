import { Fragment } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface BlurWordsProps {
  text: string;
  /** Opóźnienie pierwszego słowa (s). */
  delay?: number;
  /** Odstęp między kolejnymi słowami (s). */
  stagger?: number;
}

/**
 * Tekst wyłaniający się słowo po słowie z rozmycia. Czytniki ekranu dostają cały tekst naraz
 * (sr-only), a animowane słowa są ukryte przed nimi — inaczej czytałyby je jak osobne elementy.
 * Przy „ogranicz ruch" zwraca zwykły tekst.
 */
export function BlurWords({ text, delay = 0, stagger = 0.04 }: BlurWordsProps) {
  const reduce = useReducedMotion();
  if (reduce) return <>{text}</>;

  const words = text.split(" ");
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: słowa się powtarzają, a lista jest statyczna
          <Fragment key={i}>
            <span className="blur-word" style={{ animationDelay: `${delay + i * stagger}s` }}>
              {word}
            </span>
            {i < words.length - 1 && " "}
          </Fragment>
        ))}
      </span>
    </>
  );
}
