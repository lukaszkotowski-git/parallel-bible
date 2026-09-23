import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";

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
            <motion.span
              className="inline-block"
              initial={{ opacity: 0, filter: "blur(8px)", y: "0.25em" }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ duration: 0.55, delay: delay + i * stagger, ease: [0.16, 1, 0.3, 1] }}
            >
              {word}
            </motion.span>
            {i < words.length - 1 && " "}
          </Fragment>
        ))}
      </span>
    </>
  );
}
