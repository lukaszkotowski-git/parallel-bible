/**
 * Import tłumaczeń public domain do bazy.
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
  },
];

async function loadSource(spec: TranslationSpec): Promise<SourceBible> {
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
 * Import przy każdym starcie kontenera byłby marnotrawstwem (ok. 62 tys. wierszy
 * i 132 pliki do pobrania). Jeśli baza jest już kompletna, pomijamy — chyba że
 * FORCE_IMPORT=1 wymusi odświeżenie tekstu.
 */
async function alreadyComplete(): Promise<boolean> {
  if (process.env.FORCE_IMPORT === "1") return false;
  try {
    const counts = await prisma.verse.groupBy({
      by: ["translationId"],
      _count: { _all: true },
    });
    const byId = Object.fromEntries(counts.map((c) => [c.translationId, c._count._all]));
    return TRANSLATIONS.every((t) => (byId[t.id] ?? 0) > 30000);
  } catch {
    return false;
  }
}

async function main() {
  console.log(`Źródło danych: ${LOCAL_DIR ? `katalog lokalny ${LOCAL_DIR}` : RAW_BASE}`);
  if (await alreadyComplete()) {
    console.log("✓ Tekst już zaimportowany — pomijam (FORCE_IMPORT=1 wymusza ponowny import)");
    return;
  }
  await upsertBooks();
  for (const spec of TRANSLATIONS) await importTranslation(spec);

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
