/**
 * Tło „światła" za nagłówkiem strony: snop z góry i dwie wolno dryfujące plamy w kolorze
 * `primary` (5–10% krycia) plus lekkie ziarno. Całość wygasa ku dołowi (maska w `.ambient-light`),
 * więc nie sięga pod listę ksiąg ani tekst. Czysto dekoracyjne — rodzic musi być `relative`
 * i tworzyć kontekst warstw (strony mają `relative z-10`), żeby -z-10 trafiło pod treść.
 */
export function AmbientLight() {
  return (
    <div aria-hidden="true" className="ambient-light pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden">
      <div className="ambient-light__beam" />
      <div className="ambient-light__orb ambient-light__orb--a" />
      <div className="ambient-light__orb ambient-light__orb--b" />
      <div className="ambient-light__grain" />
    </div>
  );
}
