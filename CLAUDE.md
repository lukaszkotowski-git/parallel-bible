# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Parallel Bible — a Polish/English parallel Scripture reader. English (World English Bible) reads
continuously; the Polish translation (Biblia Gdańska, 1632) is revealed per-verse on click. Full
66-book Protestant canon, 1189 chapters, ~62k verses. UI text and code comments are in Polish.

## Commands

```bash
npm run dev             # dev server (tsx, hot reload) — http://localhost:5000, serves API + Vite client
npm run build           # production build: vite build (client) + esbuild bundle (server) → dist/
npm run start           # run production build (NODE_ENV=production node dist/index.cjs)
npm run check           # tsc type-check (noEmit)

npx prisma generate     # regenerate Prisma client after schema.prisma changes
npm run db:migrate:dev  # create/apply a dev migration (prisma migrate dev)
npm run db:migrate      # apply migrations in production (prisma migrate deploy)
npm run import:bible    # import WEB + BG verse text into the database (idempotent, ~1 min)
```

There is no lint script and no test suite configured — `npm run check` (tsc) is the only
automated correctness gate. Always run it after non-trivial TypeScript changes.

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
`require()`. Note the allowlist currently includes packages not used in this project (e.g.
`drizzle-orm`, `openai`, `stripe`) — carried over from a template; if you add a new server-side
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
