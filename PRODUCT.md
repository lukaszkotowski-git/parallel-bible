# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Two equal audiences, no confirmed priority between them:
- Polish speakers who read Scripture in English (World English Bible) and lean on a Polish translation for the hard verses — Scripture as a way into the language.
- Believers doing systematic Bible study, comparing translations verse by verse and reading on a schedule (plans, progress, notes, groups).

## Product Purpose
A parallel Scripture reader. One translation reads continuously; a second is revealed per verse on click. Both are chosen from any imported translation (defaults: World English Bible and Biblia Gdańska 1632). Covers the full 66-book Protestant canon (1189 chapters, ~62k verses). Success is a reader who comes back daily and finishes chapters.

## Positioning
Reveal-on-click pairing: continuous reading in one language with the second translation one tap away, for any pair of imported translations. Around it sits a habit-and-learning layer (flashcards, verse of the day, badges, daily goal, leaderboard, groups) that reinforces the reading rather than replacing it.

## Operating Context
Used on phones and desktops, in short daily sessions and longer study sittings. Reading is public; an account is only needed to save progress, favorites, notes and settings across devices. Translations: WEB (en), Biblia Gdańska and Biblia Jakuba Wujka (pl), Reina-Valera 1909 (es).

## Capabilities and Constraints
- Reading (`/api/books`, `/api/chapter/*`) never requires an account; all user state sits behind `/api/me/*`.
- Only public-domain texts. No UBG, RVR1960 or newer Reina-Valera revisions.
- UI text and code comments are in Polish.
- Verse pairing across translations is best-effort by verse number; some chapters have unpaired tail verses.
- Chapter summaries exist only in English and Polish.
- Light and dark theme; anonymous fallback in localStorage, server value once logged in.
- Navigation uses hash routing and the View Transitions API.

## Brand Commitments
Name: Parallel Bible. Polish UI voice. Motion is part of the product (hero demo, text animation, page transitions, celebration confetti) and must honor `prefers-reduced-motion`.

## Evidence on Hand
Complete Scripture data in the database; a `marketing/sizzle-reel` directory (untracked). No testimonials, user counts or press exist — do not fabricate them.

## Product Principles
- Scripture is public: never gate reading behind an account.
- The reading text leads; the second translation and gamification support it and never crowd it.
- Public-domain texts only; licensing is load-bearing.
- Best-effort verse alignment is shown honestly, not hidden.
- Motion and celebration are welcome only when they respect reduced-motion preferences.

## Accessibility & Inclusion
Respect `prefers-reduced-motion`. Biome lint enforces a11y rules on the client.
