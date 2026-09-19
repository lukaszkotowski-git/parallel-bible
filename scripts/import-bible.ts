/**
 * Import tłumaczeń public domain do bazy (WEB, Biblia Gdańska, Biblia Wujka, Reina-Valera).
 *
 *   npm run import:bible                    # pobiera dane z GitHuba (midvash/bible-data)
 *   BIBLE_DATA_DIR=/ścieżka npm run import:bible   # import z lokalnego klona repo
 *
 * Skrypt jest idempotentny: przed wstawieniem czyści wersety danego tłumaczenia.
 * Kończy się błędem, jeśli dane nie przechodzą weryfikacji integralności
 * (66 ksiąg, 1189 rozdziałów, zgodność liczby rozdziałów z tablicą referencyjną).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { BOOKS, BOOK_BY_ID, TOTAL_BOOKS, TOTAL_CHAPTERS } from "../shared/books";
import { loadWujek } from "./wujek";

const prisma = new PrismaClient();

const RAW_BASE =
  process.env.BIBLE_DATA_RAW ??
  "https://raw.githubusercontent.com/midvash/bible-data/main/versions";
const LOCAL_DIR = process.env.BIBLE_DATA_DIR; // np. /data/bible-data (klon repo)

interface SourceBible {
  version: string;
  name: string;
  language: string;
  license: string;
  books: {
    book: string;
    bookId: number;
    englishName: string;
    testament: string;
    chapters: { chapter: number; verses: { number: number; text: string }[] }[];
  }[];
}

interface TranslationSpec {
  id: string; // klucz w bazie
  lang: string; // katalog języka w źródle
  slug: string; // katalog wersji w źródle
  name: string;
  shortName: string;
  year: number;
  sourceUrl: string;
  isDefault: boolean;
  /** Minimalna liczba wersetów, powyżej której tłumaczenie uznajemy za już zaimportowane. */
  minVerses: number;
  /** Własny loader dla źródeł spoza midvash/bible-data (lang/slug wtedy tylko opisują źródło). */
  load?: () => Promise<SourceBible>;
}

const TRANSLATIONS: TranslationSpec[] = [
  {
    id: "WEB",
    lang: "en",
    slug: "web",
    name: "World English Bible",
    shortName: "WEB",
    year: 2000,
    sourceUrl: "https://worldenglish.bible/",
    isDefault: true,
    minVerses: 30000,
  },
  {
    id: "BG",
    lang: "pl",
    slug: "bg",
    name: "Biblia Gdańska",
    shortName: "BG",
    year: 1632,
    sourceUrl: "https://github.com/midvash/bible-data",
    isDefault: false,
    minVerses: 30000,
  },
  {
    // Wydanie 1923 z Wikiźródeł (przekład 1599, domena publiczna), parsowane z EPUB-a przez scripts/wujek.ts.
    id: "WUJ",
    lang: "pl",
    slug: "wujek",
    name: "Biblia Jakuba Wujka",
    shortName: "BW",
    year: 1599,
    sourceUrl: "https://pl.wikisource.org/wiki/Biblia_Wujka_(1923)",
    isDefault: false,
    minVerses: 30000,
    // Numeracja psalmów w źródle jest z Wulgaty — loader dopasowuje ją do WEB.
    load: async () => (await loadWujek(await loadSource(TRANSLATIONS[0]))) as SourceBible,
  },
  {
    id: "RV",
    lang: "es",
    slug: "rv",
    name: "Reina-Valera 1909",
    shortName: "RV1909",
    year: 1909,
    sourceUrl: "https://github.com/scrollmapper/bible_databases",
    isDefault: false,
    minVerses: 30000,
    load: loadReinaValera,
  },
];

const sourceCache = new Map<string, Promise<SourceBible>>();

/** Źródło każdego tłumaczenia pobieramy raz, nawet jeśli potrzebuje go też inny loader. */
function loadSource(spec: TranslationSpec): Promise<SourceBible> {
  let p = sourceCache.get(spec.id);
  if (!p) {
    p = spec.load ? spec.load() : loadRemote(spec);
    sourceCache.set(spec.id, p);
  }
  return p;
}

/**
 * Reina-Valera 1909 (domena publiczna) z scrollmapper/bible_databases. Nazwy ksiąg w źródle są
 * angielskie i nie pasują do naszych id, więc mapujemy po kolejności kanonu (weryfikowanej liczbą
 * ksiąg i rozdziałów). Nieliczne puste wersety (tekst krytyczny bez wstawek) pomijamy.
 */
const RV_URL =
  process.env.RV_URL ??
  "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/SpaRV.json";

async function loadReinaValera(): Promise<SourceBible> {
  let raw: { books: { chapters: { chapter: number; verses: { verse: number; text: string }[] }[] }[] };
  if (process.env.RV_FILE) {
    raw = JSON.parse(await readFile(process.env.RV_FILE, "utf8"));
  } else {
    const res = await fetch(RV_URL);
    if (!res.ok) throw new Error(`Pobieranie ${RV_URL} nie powiodło się: ${res.status}`);
    raw = (await res.json()) as typeof raw;
  }
  if (raw.books.length !== BOOKS.length) {
    throw new Error(`Reina-Valera: ${raw.books.length} ksiąg w źródle zamiast ${BOOKS.length}`);
  }
  return {
    version: "SpaRV",
    name: "Reina-Valera 1909",
    language: "es",
    license: "public domain",
    books: raw.books.map((b, i) => ({
      book: BOOKS[i].id,
      bookId: i + 1,
      englishName: BOOKS[i].nameEn,
      testament: BOOKS[i].testament,
      chapters: b.chapters.map((c) => ({
        chapter: c.chapter,
        verses: c.verses.filter((v) => v.text.trim()).map((v) => ({ number: v.verse, text: v.text })),
      })),
    })),
  };
}

async function loadRemote(spec: TranslationSpec): Promise<SourceBible> {
  const rel = `${spec.lang}/${spec.slug}/${spec.slug}.json`;
  if (LOCAL_DIR) {
    const file = path.join(LOCAL_DIR, "versions", rel);
    return JSON.parse(await readFile(file, "utf8")) as SourceBible;
  }
  const url = `${RAW_BASE}/${rel}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pobieranie ${url} nie powiodło się: ${res.status}`);
  return (await res.json()) as SourceBible;
}

/** Normalizacja tekstu: bez zmian merytorycznych, tylko czyszczenie białych znaków. */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function verify(spec: TranslationSpec, src: SourceBible) {
  const problems: string[] = [];
  if (src.books.length !== TOTAL_BOOKS) {
    problems.push(`liczba ksiąg ${src.books.length} ≠ ${TOTAL_BOOKS}`);
  }
  let chapters = 0;
  for (const book of src.books) {
    const ref = BOOK_BY_ID[book.book];
    if (!ref) {
      problems.push(`nieznana księga "${book.book}"`);
      continue;
    }
    chapters += book.chapters.length;
    if (book.chapters.length !== ref.chapterCount) {
      problems.push(
        `${ref.namePl}: ${book.chapters.length} rozdz. w źródle vs ${ref.chapterCount} w tablicy referencyjnej`,
      );
    }
    for (const ch of book.chapters) {
      if (ch.verses.length === 0) problems.push(`${ref.namePl} ${ch.chapter}: brak wersetów`);
    }
  }
  if (chapters !== TOTAL_CHAPTERS) {
    problems.push(`suma rozdziałów ${chapters} ≠ ${TOTAL_CHAPTERS}`);
  }
  if (problems.length) {
    throw new Error(
      `Weryfikacja integralności [${spec.id}] nie powiodła się:\n  - ${problems.join("\n  - ")}`,
    );
  }
}

async function upsertBooks() {
  for (const b of BOOKS) {
    await prisma.book.upsert({
      where: { id: b.id },
      update: {
        namePl: b.namePl,
        nameEn: b.nameEn,
        testament: b.testament,
        sortOrder: b.sortOrder,
        chapterCount: b.chapterCount,
      },
      create: {
        id: b.id,
        namePl: b.namePl,
        nameEn: b.nameEn,
        testament: b.testament,
        sortOrder: b.sortOrder,
        chapterCount: b.chapterCount,
      },
    });
  }
  console.log(`✓ Księgi: ${BOOKS.length} (rozdziałów łącznie: ${TOTAL_CHAPTERS})`);
}

async function importTranslation(spec: TranslationSpec) {
  const started = Date.now();
  const src = await loadSource(spec);
  verify(spec, src);

  await prisma.translation.upsert({
    where: { id: spec.id },
    update: {
      language: spec.lang,
      name: spec.name,
      shortName: spec.shortName,
      year: spec.year,
      license: "public domain",
      sourceUrl: spec.sourceUrl,
      isDefault: spec.isDefault,
    },
    create: {
      id: spec.id,
      language: spec.lang,
      name: spec.name,
      shortName: spec.shortName,
      year: spec.year,
      license: "public domain",
      sourceUrl: spec.sourceUrl,
      isDefault: spec.isDefault,
    },
  });

  await prisma.verse.deleteMany({ where: { translationId: spec.id } });

  const rows: { translationId: string; bookId: string; chapter: number; verse: number; text: string }[] = [];
  for (const book of src.books) {
    for (const ch of book.chapters) {
      for (const v of ch.verses) {
        rows.push({
          translationId: spec.id,
          bookId: book.book,
          chapter: ch.chapter,
          verse: v.number,
          text: normalize(v.text),
        });
      }
    }
  }

  const CHUNK = 5000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await prisma.verse.createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: true });
    process.stdout.write(`\r  ${spec.id}: ${Math.min(i + CHUNK, rows.length)}/${rows.length} wersetów`);
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\r✓ ${spec.name} (${spec.id}): ${rows.length} wersetów w ${seconds}s        `);
}

/**
 * Import przy każdym starcie kontenera byłby marnotrawstwem (ok. 31 tys. wierszy na tłumaczenie
 * i pobieranie źródeł). Tłumaczenia, które są już w bazie, pomijamy — chyba że FORCE_IMPORT=1
 * wymusi odświeżenie tekstu. Sprawdzamy każde osobno, więc dodanie nowego tłumaczenia
 * importuje tylko je, bez ruszania reszty.
 */
async function pendingTranslations(): Promise<TranslationSpec[]> {
  if (process.env.FORCE_IMPORT === "1") return TRANSLATIONS;
  try {
    const counts = await prisma.verse.groupBy({
      by: ["translationId"],
      _count: { _all: true },
    });
    const byId = Object.fromEntries(counts.map((c) => [c.translationId, c._count._all]));
    return TRANSLATIONS.filter((t) => (byId[t.id] ?? 0) <= t.minVerses);
  } catch {
    return TRANSLATIONS;
  }
}

async function main() {
  console.log(`Źródło danych: ${LOCAL_DIR ? `katalog lokalny ${LOCAL_DIR}` : RAW_BASE}`);
  const pending = await pendingTranslations();
  if (pending.length === 0) {
    console.log("✓ Tekst już zaimportowany — pomijam (FORCE_IMPORT=1 wymusza ponowny import)");
    return;
  }
  await upsertBooks();
  for (const spec of pending) await importTranslation(spec);

  const summary = await prisma.verse.groupBy({
    by: ["translationId"],
    _count: { _all: true },
  });
  console.log("\nPodsumowanie:");
  for (const row of summary) console.log(`  ${row.translationId}: ${row._count._all} wersetów`);
}

main()
  .catch((err) => {
    console.error("\n✗ Import przerwany:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
