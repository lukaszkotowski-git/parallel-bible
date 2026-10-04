import { useRef } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}

const formatPercent = (v: number) => (v > 0 && v < 10 ? v.toFixed(1) : String(Math.round(v)));

// Ostatnia pokazana wartość: pierścień w nagłówku montuje się na każdej stronie, więc animujemy
// tylko od wartości, którą użytkownik już widział (pierwszy raz od zera, potem tylko zmiany).
let lastPercent = 0;

/** Kołowy wskaźnik postępu czytania. Procent w środku, pełny opis w tooltipie rodzica. */
export function ProgressRing({
  percent,
  size = 44,
  strokeWidth = 3.5,
  className,
  label,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const arcRef = useRef<SVGCircleElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  // Łuk i liczba płyną razem z jednego tweenu (bez CSS transition, który rozjeżdżałby się z liczbą).
  useGSAP(
    () => {
      const arc = arcRef.current;
      const num = numRef.current;
      if (!arc || !num) return;
      const paint = (v: number) => {
        arc.style.strokeDashoffset = String(circumference - (v / 100) * circumference);
        num.textContent = formatPercent(v);
      };
      const from = reduce || document.hidden ? clamped : lastPercent;
      paint(from);
      if (from === clamped) {
        lastPercent = clamped;
        return;
      }
      const state = { v: from };
      const tween = gsap.to(state, {
        v: clamped,
        duration: 0.9,
        ease: "power2.out",
        onUpdate: () => paint(state.v),
        onComplete: () => {
          lastPercent = clamped;
        },
      });
      return () => {
        tween.kill();
        paint(clamped);
        lastPercent = clamped;
      };
    },
    { dependencies: [clamped, circumference, reduce] },
  );

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `Przeczytane ${clamped}% Biblii`}
      data-testid="progress-ring"
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-border"
        />
        <circle
          ref={arcRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          className="stroke-primary"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-sans font-medium tabular-nums"
        style={{ fontSize: Math.max(9, size * 0.26) }}
        data-testid="text-progress-percent"
      >
        <span ref={numRef} />
        <span className="text-[0.65em] opacity-70">%</span>
      </span>
    </div>
  );
}
