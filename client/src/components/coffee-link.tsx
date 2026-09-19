import { Coffee } from "lucide-react";
import { useAppConfig } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * „Postaw mi kawę" — zwykły link do zewnętrznej strony (Buy Me a Coffee). Pokazuje się tylko,
 * gdy serwer ma ustawione BUYMEACOFFEE_URL. Celowo spokojny: bez pop-upów i przypominajek.
 */
export function CoffeeLink({ className }: { className?: string }) {
  const { data } = useAppConfig();
  if (!data?.coffeeUrl) return null;
  return (
    <a
      href={data.coffeeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      data-testid="link-coffee"
    >
      <Coffee className="h-4 w-4" aria-hidden="true" />
      Postaw mi kawę
      <span className="sr-only"> (otwiera się w nowej karcie)</span>
    </a>
  );
}
