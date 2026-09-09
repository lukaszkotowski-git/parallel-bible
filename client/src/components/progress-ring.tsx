import { cn } from "@/lib/utils";

interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}

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
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `Przeczytane ${clamped}% Biblii`}
      data-testid="progress-ring"
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-sans font-medium tabular-nums"
        style={{ fontSize: Math.max(9, size * 0.26) }}
        data-testid="text-progress-percent"
      >
        {clamped > 0 && clamped < 10 ? clamped.toFixed(1) : Math.round(clamped)}
        <span className="text-[0.65em] opacity-70">%</span>
      </span>
    </div>
  );
}
