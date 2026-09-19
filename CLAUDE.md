# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Parallel Bible — a parallel Scripture reader. One translation reads continuously ("czytam", default
World English Bible); a second one is revealed per-verse on click ("tłumaczenie", default Biblia
Gdańska, 1632). Both are user-selectable from any imported translation. Full
66-book Protestant canon, 1189 chapters, ~62k verses. UI text and code comments are in Polish.
Translations: `WEB` (en), `BG` and `WUJ` (Biblia Jakuba Wujka, pl), `RV` (Reina-Valera 1909, es).

## Commands

```bash
npm run dev             # dev server (tsx, hot reload) — http://localhost:5000, serves API + Vite client
npm run build           # production build: vite build (client) + esbuild bundle (server) → dist/
npm run start           # run production build (NODE_ENV=production node dist/index.cjs)
npm run check           # tsc type-check (noEmit)
npm run lint            # Biome lint (errors fail; warnings are informational)

npx prisma generate     # regenerate Prisma client after schema.prisma changes
npm run db:migrate:dev  # create/apply a dev migration (prisma migrate dev)
npm run db:migrate      # apply migrations in production (prisma migrate deploy)
npm run import:bible    # import WEB + BG verse text into the database (idempotent, ~1 min)
```

There is no test suite configured. `npm run check` (tsc) is the main correctness gate — always run
it after non-trivial TypeScript changes; `npm run lint` (Biome, errors only; `components/ui/` and CSS
are excluded) catches a11y and hook mistakes.

Local setup: `cp .env.example .env` (set `DATABASE_URL` for a local Postgres 16 and
`BETTER_AUTH_SECRET`), then
`npm install && npx prisma generate && npm run db:migrate:dev && npm run import:bible`.
There is no seeded account — register through the UI at `/#/login`.

The bible import can read from a local clone instead of fetching over HTTP:
`git clone --depth 1 https://github.com/midvash/bible-data /data/bible-data && BIBLE_DATA_DIR=/data/bible-data npm run import:bible`.
Import controls: `FORCE_IMPORT=1` re-imports even if text already exists; `alreadyComplete()` in
`scripts/import-bible.ts` normally skips re-importing when both translations already have >30k rows.

## Architecture

**One Express process serves both the API and the built client** (`server/index.ts`). In dev it
mounts Vite in middleware mode (`server/vite.ts`); in production it serves the static build
(`server/static.ts`). Routes are split into read-only Scripture content vs. mutable user state —
see the comment blocks in `server/routes.ts`.

**Reading is public; saving requires an account.** This split is the core product constraint:
`/api/books` and `/api/chapter/*` never require a session, while the whole `/api/me/*` prefix sits
behind one `app.use("/api/me", requireAuth)` gate in `server/routes.ts`. `requireAuth`
(`server/auth.ts`) resolves the Better Auth session and puts the id in `req.userId`; `getUserId(req)`
in `server/db.ts` only reads it back, so individual route handlers never touch sessions. Keep that
shape: gate new user-scoped routes by mounting them under `/api/me`, never by calling
`auth.api.getSession` inside a handler.

Because logged-out visitors get a `401` from `/api/me/*`, every client query against that prefix
must be gated on the session (`enabled: authed`, via `useAuthed()` in `components/app-header.tsx`),
otherwise the page throws on load for anonymous readers. Theme is the one piece of user state with
an anonymous fallback — `localStorage` key `pb-theme`, overridden by the DB value once logged in.

**Two ordering traps in the auth wiring** (both already handled, don't "clean them up"):
`app.all("/api/auth/*splat", toNodeHandler(auth))` must stay *above* `express.json()` in
`server/index.ts` — the body parser would consume the stream Better Auth needs — and the `*splat`
named wildcard is required by Express 5's path-to-regexp, plain `*` throws at startup.

Better Auth is ESM-only, so it is in the `allowlist` in `script/build.ts` (bundled into the CJS
output) rather than left as an external `require()`.

**Data model** (`prisma/schema.prisma`): Scripture content (`Book`, `Translation`, `Verse`) is
treated as immutable reference data populated once by `scripts/import-bible.ts`; user data
(`User`, `ReadChapter`, `ReadingPosition`, `Favorite`) is the only mutable part. `Book.id` is an
OSIS-like short code (`Gen`, `Ps`, `John`, `Rev`) used as the canonical key everywhere — client
routes, API paths, and the `shared/books.ts` reference table all key off it.

**`shared/`** is imported by both server and client via the `@shared/*` path alias (see
`tsconfig.json` / `vite.config.ts`).
- `shared/books.ts` — the 66-book canon table (id, Polish/English names, testament, chapter
  counts). This is the integrity reference: `scripts/import-bible.ts` verifies imported source
  data against it (66 books, 1189 chapters total) and fails the import if it doesn't match.
- `shared/schema.ts` — API request/response DTOs and Zod input-validation schemas
  (`chapterRefSchema`, `favoriteInputSchema`, `themeSchema`), used by both `server/routes.ts` and
  the client's `lib/api.ts`.

**Translation pair**: every `Translation` row with verses is selectable (`GET /api/translations`,
public). The chapter endpoint takes `?read=<id>&alt=<id>`; `resolvePair()` in `shared/translations.ts`
falls back to WEB/BG for unknown ids and forces the two to differ (used by server and client alike).
The client keeps the choice in `localStorage` (`pb-read`, `pb-alt`), overridden by
`User.readTranslation`/`altTranslation` once logged in (same pattern as theme; `useTranslations()` in
`client/src/lib/translations.ts`; picking the other slot's translation swaps them). The chapter query key
includes both ids. DTO fields are language-neutral (`text` = read, `alt` = revealed). Flashcards/verse
of the day (`server/learn.ts`) follow the user's pair. Chapter summaries (`ChapterSummary`) exist only
in en/pl, so `ChapterCommentary` shows only those languages present in the pair (hidden when neither is en or pl).
Chapter/verse *structure* (read counts, learn-card validation) is anchored to WEB. To add another
public-domain translation, add a `TranslationSpec` in `scripts/import-bible.ts` (plus a `LANGUAGE_LABELS`
entry for a new language) — the import skips translations already in the DB, so it only loads the new one.
`RV` comes from `scrollmapper/bible_databases` (`SpaRV.json`), mapped to books by canon order; ~18 empty
source verses are skipped. Do not substitute RVR1960 or newer Reina-Valera revisions (copyrighted).

**Wujek is parsed, not downloaded as JSON**: `scripts/wujek.ts` fetches the Wikisource EPUB
(`syndereza/biblia-wujka`, override with `WUJEK_EPUB=/path` or `WUJEK_EPUB_URL`) and parses it locally
with a tiny built-in ZIP reader. The source uses Vulgate Psalm numbering, remapped to Hebrew in
`psalmTarget`; psalm titles are merged into verse 1 to match WEB (`alignPsalmTitle`, needs the WEB
source as reference, so WEB must come first in `TRANSLATIONS`). ~100 chapters still differ from WEB
by 1–2 verses (Vulgate versification) — the usual best-effort pairing applies.

**Verse pairing across translations is best-effort by verse number**, not a hard join — WEB and BG
verse numbering doesn't always agree (`server/storage.ts:getChapter`). Verses present in English
pair with their Polish counterpart when the verse numbers match; Polish verses with no English
counterpart are returned separately as `extraPl` (chapter "tail"), currently affecting 5 chapters
(e.g. Romans 16). When touching chapter-rendering logic, preserve this separation rather than
assuming a 1:1 verse mapping.

**Client** (`client/src/`): React 18 + Vite + TanStack Query + wouter, using **hash-based routing**
(`useHashLocation` in `App.tsx`) — routes are `/#/`, `/#/ksiega/:book`, `/#/czytaj/:book/:chapter`.
UI components are shadcn/ui (Radix primitives) under `client/src/components/ui/`, treated as
generated/vendored — prefer composing them over editing internals. `client/src/lib/api.ts` centralizes
all API calls and TanStack Query keys (`qk`); `invalidateUserState()` is the single place that
invalidates all user-state-dependent queries after a mutation — call it (or add to it) rather than
invalidating query keys ad hoc.

**Build** (`script/build.ts`): builds the client with Vite, then bundles the server with esbuild
into a single `dist/index.cjs` (CJS, minified). Only dependencies in the `allowlist` array get
bundled into the server output; everything else in `package.json` is left as an external
`require()`. The allowlist lists only packages the server actually imports (`better-auth`, `express`, `nanoid`, `zod`); if you add a new server-side
runtime dependency that should be bundled, add it to this allowlist or the production build will
fail to find it at runtime.

## Deployment

Docker + docker-compose, targeting Dokploy. `docker-entrypoint.sh` runs on container start, in
order: `prisma migrate deploy` → conditional bible import → `exec "$@"`.
Required env beyond `DATABASE_URL`: `BETTER_AUTH_SECRET` (the app refuses to start in production
without it) and `BETTER_AUTH_URL` (public origin; OAuth callbacks are built from it).
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are optional — absent, the Google button disappears and
only email+password remains.
- `RUN_IMPORT=never` skips the import step entirely.
- `FORCE_IMPORT=1` forces re-import even if text already exists.
- Import failures are non-fatal at startup (logged, app still starts) since re-running the import
  later is safe (idempotent).

## Licensing constraint

Both texts (World English Bible, Biblia Gdańska 1632) are public domain — this is load-bearing for
the project. Do not substitute in the *Uwspółcześniona* Biblia Gdańska (UBG) translation or any
other non-public-domain text without a license; it is explicitly called out in the README as
incompatible with this project's licensing model.
