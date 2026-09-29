---
name: Parallel Bible
description: Czytnik Pisma w dwóch przekładach — ciepły papier, szeryfowy tekst, bursztynowy akcent, płasko.
colors:
  amber-ink: "hsl(32 62% 38%)"
  amber-ink-on: "hsl(40 45% 97%)"
  parchment: "hsl(40 33% 96%)"
  parchment-card: "hsl(42 50% 98%)"
  parchment-sunk: "hsl(40 22% 91%)"
  parchment-tint: "hsl(38 28% 89%)"
  parchment-deep: "hsl(38 26% 90%)"
  rule: "hsl(36 20% 86%)"
  rule-card: "hsl(36 22% 89%)"
  rule-input: "hsl(36 18% 78%)"
  ink: "hsl(30 14% 14%)"
  ink-soft: "hsl(32 10% 40%)"
  ink-translation: "hsl(32 12% 34%)"
  verse-number: "hsl(32 20% 36%)"
  moss-marker: "hsl(148 30% 32%)"
  brick-alert: "hsl(8 62% 42%)"
  candle-gold: "hsl(42 55% 45%)"
typography:
  display:
    fontFamily: "Zodiak, 'Source Serif 4', ui-serif, serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.025em"
  body:
    fontFamily: "'General Sans', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'General Sans', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  scripture-read:
    fontFamily: "'Source Serif 4', ui-serif, serif"
    fontSize: "clamp(1.0625rem, 0.98rem + 0.42vw, 1.25rem)"
    fontWeight: 400
    lineHeight: 1.72
    letterSpacing: "-0.003em"
  scripture-alt:
    fontFamily: "'Source Serif 4', ui-serif, serif"
    fontSize: "clamp(1rem, 0.94rem + 0.3vw, 1.125rem)"
    fontWeight: 400
    lineHeight: 1.66
rounded:
  xs: "3px"
  sm: "4px"
  md: "6px"
  lg: "9px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.amber-ink}"
    textColor: "{colors.amber-ink-on}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  card:
    backgroundColor: "{colors.parchment-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  book-tile:
    backgroundColor: "{colors.parchment-card}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "12px"
  input:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "36px"
---

# Design System: Parallel Bible

## Overview

**Creative North Star: "The Lamplit Study"**

Cicha pracownia przy lampie: ciepły papier, długi szeryfowy tekst, jeden bursztynowy akcent jak światło świecy. Interfejs jest płaski i dotykowy — głębię dają ton, cienka linia i delikatna nakładka po najechaniu, nigdy cień. Tekst Pisma jest jedynym bohaterem; drugi przekład, odznaki i animacje zostają w jego cieniu i wchodzą dopiero na życzenie.

Gęstość jest niska, a rytm wolny: wąska kolumna czytania (`max-w-3xl`), hojna interlinia, małe kafelki ksiąg jako spis treści. Motion jest częścią produktu (przejścia widoku, dryfujące światło za nagłówkiem, konfetti za odznaki), ale zawsze wygasza się przy `prefers-reduced-motion`. Tryb ciemny to ta sama pracownia po zmroku — ciepły brąz, nie czerń.

**Key Characteristics:**
- Ciepły papier (kremowe tło, delikatna kropkowana faktura) zamiast bieli.
- Szeryfowy tekst czytany ciągiem; bezszeryfowy interfejs; szeryfowy display dla marki i tytułów.
- Jeden akcent (bursztyn) plus zielony znacznik „przeczytane".
- Zerowe cienie; głębia przez ton, linię i nakładkę elevate.
- Drugi przekład kursywą, wyciszony, z bursztynową kreską z lewej.

## Colors

Paleta pergaminu i atramentu: kremowe tła, brązowy tusz, jeden bursztynowy akcent i mech dla ukończenia. Wartości w HSL (źródło prawdy: `client/src/index.css`); ciemny motyw przesuwa ten sam odcień w stronę ciepłego brązu.

### Primary
- **Bursztynowy Atrament** (hsl(32 62% 38%); ciemny: hsl(34 68% 56%)): akcent marki — przyciski główne, rozdzielacz w logotypie („Bible"), pierścień fokusu, liczniki w toku, kreska przy drugim przekładzie. Tekst na nim: **Pergaminowa Biel** (hsl(40 45% 97%)).

### Secondary
- **Mech Ukończenia** (hsl(148 30% 32%); ciemny: hsl(148 34% 52%)): wyłącznie znacznik przeczytanego rozdziału/księgi i seria wykresów.
- **Złoto Świecy** (hsl(42 55% 45%)): drugorzędna plama światła w tle nagłówka i seria wykresu.

### Neutral
- **Pergamin** (hsl(40 33% 96%); ciemny: hsl(30 10% 9%)): tło strony.
- **Karta Pergaminowa** (hsl(42 50% 98%); ciemny: hsl(30 9% 12%)): karty, kafelki, popovery — jaśniejsze od strony o pół tonu.
- **Zagłębiony Pergamin** (hsl(40 22% 91%)) i **Pergaminowy Odcień** (hsl(38 28% 89%)): muted / accent, tła hovera i rozwiniętego wersetu.
- **Tusz** (hsl(30 14% 14%); ciemny: hsl(40 22% 90%)): tekst główny.
- **Tusz Wyciszony** (hsl(32 10% 40%)) i **Tusz Przekładu** (hsl(32 12% 34%)): tekst pomocniczy i drugi przekład (kontrast AA na karcie).
- **Numer Wersetu** (hsl(32 20% 36%)): numery wersetów, dekoracyjne (ukryte dla czytników ekranu).
- **Linia** (hsl(36 20% 86%)), **Linia Karty** (hsl(36 22% 89%)), **Linia Pola** (hsl(36 18% 78%)): obramowania.
- **Cegła Alarmu** (hsl(8 62% 42%)): tylko destrukcyjne akcje i błędy.

Wyróżnienia wersetów to cztery półprzezroczyste znaczniki (żółty, zielony, niebieski, różowy; 20–28% krycia), żeby tekst zachował kontrast w obu motywach.

### Named Rules
**The One Lamp Rule.** Bursztyn to jedyne światło w pokoju: nigdy dwa akcenty konkurujące na jednym ekranie. Mech oznacza wyłącznie ukończenie, nie dekoracje.
**The Warm Dark Rule.** Tryb ciemny nie jest czarny ani szary; zawsze brąz o odcieniu 30–40°.

## Typography

**Display Font:** Zodiak (z Source Serif 4, ui-serif)
**Body Font:** General Sans (z ui-sans-serif, system-ui)
**Scripture Font:** Source Serif 4 (zmienna `--reading-font` pozwala czytelnikowi zamienić krój, `--reading-scale` skaluje rozmiar)

**Character:** Szeryf do czytania i marki, bezszeryf do wszystkiego, co jest interfejsem — jak marginesy i numeracja przy druku księgi.

### Hierarchy
- **Display** (700, 1.125rem, 1, −0.025em): znak „Parallel Bible" i tytuły ksiąg.
- **Body** (400–500, 0.875rem, 1.5): interfejs, przyciski, listy.
- **Label** (500, 0.75rem, 1.33): liczniki rozdziałów, podpisy kafelków, metadane; cyfry tabelaryczne.
- **Scripture — czytany** (400, clamp(1.0625rem → 1.25rem), 1.72, −0.003em): tekst czytany ciągiem; miara ok. 62–68 znaków.
- **Scripture — odsłaniany** (400 kursywa, clamp(1rem → 1.125rem), 1.66, Tusz Przekładu): drugi przekład.

### Named Rules
**The Two Voices Rule.** Tekst czytany jest prosty i ciemny, tekst odsłaniany kursywą i wyciszony; hierarchia to krój, nie kolor akcentu.
**The Lang Rule.** Każdy fragment Pisma nosi atrybut `lang` przekładu.

## Layout

Pojedyncza wąska kolumna (`max-w-3xl`, padding 16px, od `sm` 24px), przyklejony nagłówek o wysokości 64px z rozmytym tłem (`bg-background/85`, `backdrop-blur-sm`). Spis ksiąg to siatka kafelków 2 → 3 → 4 kolumny (`gap-2`). Werset to wiersz o trzech kolumnach (numer 1.75–2.25rem, treść, akcje) z podsiatką. Na telefonie nawigacja rozdziałów jest przyklejona, na desktopie w treści. Rytm oparty o krok 4px (`--spacing: 0.25rem`).

## Elevation & Depth

System jest płaski. Wszystkie tokeny cieni są wyzerowane (alfa 0); głębię dają ton (karta jaśniejsza od tła), cienka linia i nakładka **elevate**: przy hoverze `rgba(0,0,0,0.03)` (ciemny: białe 0.04), przy aktywnym/przełączonym 0.08–0.09. Jedyna „atmosfera" to bardzo delikatna kropkowana faktura papieru na `body` oraz dryfujące światło za nagłówkiem strony głównej (plamy 5–10% krycia, ziarno 4–7%, maska wygasza ku dołowi).

### Named Rules
**The Flat-By-Default Rule.** Żadnych cieni; reakcja na dotyk to nakładka elevate, nie uniesienie.
**The Quiet Atmosphere Rule.** Tło światła nigdy nie wchodzi pod listę ani tekst — maska gaśnie w 35%.

## Shapes

Łagodne, niezbyt okrągłe rogi: skala 3 / 4 / 6 / 9 px (`xs`–`lg`), karty 12px (`rounded-xl`), awatary i chipy pełne koło. Przyciski i pola 6px, kafelki i wiersze wersetów 9px. Obramowania 1px w kolorze linii; obramowanie „przycisków wypełnionych" jest pochodną koloru wypełnienia przesuniętą o kilka punktów jasności. Znak marki: otwarta księga z dwóch równoległych łuków i bursztynową kropką nad grzbietem.

## Components

### Buttons
- **Shape:** 6px, min-wysokość 36px (`sm` 32px, `lg` 40px), ikony 16px.
- **Primary:** Bursztynowy Atrament z tekstem Pergaminowej Bieli, padding 8×16px, obramowanie wyprowadzone z wypełnienia.
- **Hover / Focus:** nakładka elevate; fokus to pierścień 2px w bursztynie z odsunięciem od tła.
- **Secondary / Outline / Ghost:** odpowiednio Pergamin Głęboki, obramowanie `rgba(0,0,0,0.1)`, przezroczysta ramka (bez skoku układu).

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Karta Pergaminowa; **Border:** Linia Karty 1px.
- **Shadow Strategy:** brak; zob. Elevation.
- **Internal Padding:** 24px (kafelki 12px).

### Inputs / Fields
- **Style:** tło strony, obramowanie Linia Pola, 6px, wysokość 36px.
- **Focus:** pierścień 2px w bursztynie + odsunięcie.
- **Error / Disabled:** Cegła Alarmu; dezaktywowane 50% krycia.

### Navigation
Przyklejony nagłówek: znak i nazwa po lewej, po prawej motyw, ranking i awatar (okrągły, tło bursztynu 10%). Menu użytkownika to dropdown z ikonami 16px. Linki „przejdź do treści" pojawiają się dopiero po fokusie klawiaturą.

### Kafelek księgi (sygnaturowy)
Kafelek 9px z nazwą polską (14px, medium), angielską pod spodem (12px, wyciszona) i licznikiem rozdziałów; postęp bursztynem, ukończenie mchem. Wchodzi kaskadą `tile-in` (0.5s), a tytuł księgi przepływa do nagłówka strony (View Transitions).

### Werset (sygnaturowy)
Wiersz z numerem, tekstem czytanym i akcjami (ulubione, wyróżnienie, notatka). Kliknięcie odsłania drugi przekład (`verse-reveal` 0.22s) z kreską bursztynu 40% po lewej; rozwinięty wiersz ma tło `accent/40`. Hover nigdy nie odsłania — dotyk go nie ma.

## Do's and Don'ts

### Do:
- **Do** trzymać czytany tekst w Source Serif 4 z interlinią 1.72 i miarą ok. 62–68 znaków.
- **Do** używać bursztynu oszczędnie: jeden akcent na ekran.
- **Do** budować głębię tonem, linią i nakładką elevate.
- **Do** dopasowywać animacje do `prefers-reduced-motion` i dawać unikalną nazwę `view-transition-name` na stronę.
- **Do** oznaczać każdy fragment Pisma atrybutem `lang`.

### Don't:
- **Don't** dodawać cieni ani gradientowego tekstu; system jest płaski.
- **Don't** używać czerni ani zimnej szarości w motywie ciemnym.
- **Don't** używać mchu poza znacznikiem ukończenia.
- **Don't** edytować komponentów w `client/src/components/ui/` — komponuj je.
- **Don't** dodawać drugiego koloru akcentu obok bursztynu.
