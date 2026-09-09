# Parallel Bible

Czytnik Pisma Świętego w dwóch językach: tekst angielski (World English Bible) czytasz ciągiem,
polski przekład (Biblia Gdańska) odsłaniasz kliknięciem w werset. Pełny kanon protestancki —
66 ksiąg, 1189 rozdziałów, ok. 62 tys. wersetów.

## Funkcje (MVP)

- Ekran startowy z wyborem księgi i rozdziału + filtr po nazwie
- Widok czytania z odsłanianiem PL na kliknięcie oraz przyciskiem „Rozwiń / Zwiń wszystkie PL"
- Kołowy wskaźnik postępu (procent przeczytanych rozdziałów, mianownik liczony z bazy)
- Auto-zapis postępu przy przejściu do następnego rozdziału, z toastem „Cofnij" (6 s)
- Ostatnia pozycja czytania („Kontynuuj czytanie")
- Ulubione wersety (gwiazdka przy wersecie)
- Tryb jasny / ciemny (bez konta w localStorage, z kontem synchronizowany przez serwer)
- Konta: czytanie jest publiczne, logowanie odblokowuje zapis postępu na wszystkich urządzeniach
- Responsywność: przyklejona nawigacja rozdziałów na telefonie, nawigacja w treści na desktopie

## Stack

| Warstwa | Wybór |
|---------|-------|
| Frontend | React 18 + Vite + TypeScript + Tailwind + shadcn/ui + TanStack Query + wouter |
| Backend | Express (jeden proces serwuje API i zbudowanego klienta) |
| Logowanie | Better Auth — e-mail + hasło, opcjonalnie Google |
| Baza | PostgreSQL 16 + Prisma |
| Deploy | Docker + docker-compose (Dokploy) |

## Uruchomienie lokalne

```bash
cp .env.example .env          # ustaw DATABASE_URL i BETTER_AUTH_SECRET
npm install
npx prisma generate
npx prisma migrate dev
npm run import:bible          # import tekstu (ok. 1 min z sieci)
npm run dev                   # http://localhost:5000
```

Sekret sesji wygenerujesz przez `openssl rand -base64 32`. Konto zakładasz w aplikacji
(`/#/login`) — nie ma już seedowanego konta demo.

Import może korzystać z lokalnego klonu źródła zamiast pobierania po HTTP:

```bash
git clone --depth 1 https://github.com/midvash/bible-data /data/bible-data
BIBLE_DATA_DIR=/data/bible-data npm run import:bible
```

## Wdrożenie na Dokploy

1. Nowa aplikacja typu **Docker Compose**, źródło: to repozytorium.
2. W zmiennych środowiskowych ustaw `POSTGRES_PASSWORD` (wymagane) i opcjonalnie
   `POSTGRES_USER`, `POSTGRES_DB`. Dodatkowo wymagane: `BETTER_AUTH_SECRET`
   (`openssl rand -base64 32`) oraz `BETTER_AUTH_URL` ustawiony na publiczny adres aplikacji.
3. Domenę podepnij pod usługę `app`, port `5000`.
4. Deploy. `docker-entrypoint.sh` przy starcie wykona `prisma migrate deploy` i — jeśli baza
   jest pusta — import tekstu. Kolejne restarty pomijają import.

Logowanie przez Google jest opcjonalne: ustaw `GOOGLE_CLIENT_ID` i `GOOGLE_CLIENT_SECRET`,
a w Google Cloud dodaj redirect URI `<BETTER_AUTH_URL>/api/auth/callback/google`. Bez tych
zmiennych zostaje logowanie e-mailem i hasłem, a przycisk Google się nie pokazuje.

Zmienne sterujące importem: `RUN_IMPORT=never` (pomiń krok), `FORCE_IMPORT=1` (wymuś ponowne wgranie).

Backup bazy — cron na hoście:

```bash
0 3 * * * docker exec <nazwa-kontenera-db> pg_dump -U bible parallel_bible | gzip > /backup/bible-$(date +\%F).sql.gz
```

## API

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| GET | `/api/books` | 66 ksiąg z liczbą rozdziałów |
| GET | `/api/chapter/:book/:chapter` | wersety równolegle EN/PL + nawigacja prev/next |
| GET | `/api/config` | czy włączone jest logowanie Google |
| ALL | `/api/auth/*` | endpointy Better Auth (rejestracja, logowanie, sesja, OAuth) |
| GET | `/api/me/state` | pozycja, liczba przeczytanych, procent, motyw |
| PUT | `/api/me/position` | zapis ostatniej pozycji |
| GET/POST/DELETE | `/api/me/read` | oznaczenia przeczytanych rozdziałów |
| GET/POST/DELETE | `/api/me/favorites` | ulubione wersety |
| PUT | `/api/me/theme` | motyw jasny/ciemny |
| GET | `/api/health` | healthcheck |

Identyfikator ksiąg to skrót OSIS (`Gen`, `Ps`, `John`, `Rev`).

Trasy treści (`/api/books`, `/api/chapter/*`) są publiczne. Cały prefiks `/api/me/*` stoi za
bramką `requireAuth` i bez sesji zwraca `401` — dlatego klient uruchamia te zapytania dopiero
po zalogowaniu.

## Licencje tekstów

- **World English Bible** — domena publiczna.
- **Biblia Gdańska (1632)** — domena publiczna.
- Dane pochodzą z repozytorium [midvash/bible-data](https://github.com/midvash/bible-data).

Uwaga: *Uwspółcześniona* Biblia Gdańska (UBG) **nie** jest w domenie publicznej — nie da się jej
podmienić bez licencji.

## Znane ograniczenia

- Brak ksiąg deuterokanonicznych (oba przekłady to kanon 66-księgowy).
- Numeracja wersetów WEB i BG miejscami się różni. Parowanie jest po numerze wersetu;
  wersety obecne tylko po stronie polskiej trafiają do sekcji „Dodatkowe wersety w Biblii Gdańskiej"
  (dotyczy 5 rozdziałów, m.in. Rz 16).
- Brak wyszukiwarki pełnotekstowej (planowana na `tsvector` + `pg_trgm`).
