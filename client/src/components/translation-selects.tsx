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
  /** Jedno zdanie: do czego służy ten wybór (pomijane w wersji zwartej). */
  hint?: string;
  value: string;
  options: TranslationDto[];
  onChange: (id: string) => void;
  testId: string;
}) {
  // Opcje pogrupowane po języku, w kolejności występowania na liście z serwera.
  const languages = [...new Set(props.options.map((t) => t.language))];
  return (
    <div>
      {/* Bez aria-label: nazwą kontrolki jest jej widoczna treść („Czytam: World English Bible"). */}
      <Select value={props.value} onValueChange={props.onChange}>
        <SelectTrigger className="h-11 w-full gap-1.5 text-sm sm:h-10" data-testid={props.testId}>
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
      {props.hint && <p className="mt-1 text-xs text-muted-foreground">{props.hint}</p>}
    </div>
  );
}

/** Wybór pary tłumaczeń: co czytasz ciągiem i co odsłaniasz po kliknięciu wersetu. Mieszka w oknie „Widok". */
export function TranslationSelects({ compact }: { compact?: boolean }) {
  const { read, alt, options, setRead, setAlt } = useTranslations();
  if (options.length < 2) return null;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <TranslationSelect
        label="Czytam"
        hint={compact ? undefined : "Tekst czytany ciągiem."}
        value={read}
        options={options}
        onChange={setRead}
        testId="select-read-translation"
      />
      <TranslationSelect
        label="Odsłaniam"
        hint={compact ? undefined : "Pokazywane po dotknięciu wersetu."}
        value={alt}
        options={options}
        onChange={setAlt}
        testId="select-alt-translation"
      />
    </div>
  );
}
