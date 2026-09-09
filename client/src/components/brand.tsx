import { Link } from "wouter";

/**
 * Znak marki: otwarta księga zbudowana z dwóch równoległych łuków —
 * dwa przekłady, jeden grzbiet. Działa w 20 px i w 200 px, dziedziczy kolor tekstu.
 */
export function BrandMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 7.2C10.1 5.6 7.7 4.9 4.6 5.1v12.6c3.1-.2 5.5.5 7.4 2.1" />
      <path d="M12 7.2c1.9-1.6 4.3-2.3 7.4-2.1v12.6c-3.1-.2-5.5.5-7.4 2.1" />
      <path d="M12 7.2v12.6" className="opacity-40" />
      <circle cx="12" cy="3.4" r="1.15" fill="currentColor" stroke="none" className="text-primary" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="link-home"
    >
      <BrandMark className="h-6 w-6 text-foreground" />
      <span className="font-display text-lg font-bold leading-none tracking-tight">
        Parallel<span className="text-primary"> Bible</span>
      </span>
      {!compact && (
        <span className="hidden text-xs text-muted-foreground sm:inline">EN · PL</span>
      )}
    </Link>
  );
}
