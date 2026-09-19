import { LANGUAGE_LABELS } from "@shared/translations";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TranslationDto } from "@/lib/api";
import { useTranslations } from "@/lib/translations";

function TranslationSelect(props: {
  label: string;
  value: string;
  options: TranslationDto[];
  onChange: (id: string) => void;
  testId: string;
}) {
  // Opcje pogrupowane po języku, w kolejności występowania na liście z serwera.
  const languages = [...new Set(props.options.map((t) => t.language))];
  return (
    <Select value={props.value} onValueChange={props.onChange}>
      <SelectTrigger className="h-9 w-auto gap-1.5 text-sm" aria-label={props.label} data-testid={props.testId}>
        <span className="text-xs text-muted-foreground">{props.label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectGroup key={lang}>
            <SelectLabel>{LANGUAGE_LABELS[lang] ?? lang}</SelectLabel>
            {props.options
              .filter((t) => t.language === lang)
              .map((t) => (
                <SelectItem key={t.id} value={t.id} data-testid={`${props.testId}-option-${t.id}`}>
                  {t.name}
                  {t.year ? ` (${t.year})` : ""}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Wybór pary tłumaczeń: co czytasz ciągiem i co odsłaniasz po kliknięciu wersetu. */
export function TranslationSelects() {
  const { read, alt, options, setRead, setAlt } = useTranslations();
  if (options.length < 2) return null;

  return (
    <>
      <TranslationSelect label="Czytam" value={read} options={options} onChange={setRead} testId="select-read-translation" />
      <TranslationSelect label="Tłumaczenie" value={alt} options={options} onChange={setAlt} testId="select-alt-translation" />
    </>
  );
}
