import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlTranslation } from "@/lib/pl-translation";

/** Wybór polskiego tłumaczenia; ukryty, dopóki jest tylko jedno. */
export function PlTranslationSelect() {
  const { id, options, select } = usePlTranslation();
  if (options.length < 2) return null;

  return (
    <Select value={id} onValueChange={select}>
      <SelectTrigger className="h-9 w-auto gap-1.5 text-sm" aria-label="Polskie tłumaczenie" data-testid="select-pl-translation">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((t) => (
          <SelectItem key={t.id} value={t.id} data-testid={`option-pl-${t.id}`}>
            {t.name}
            {t.year ? ` (${t.year})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
