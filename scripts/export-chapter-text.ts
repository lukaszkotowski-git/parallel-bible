/**
 * Eksport pełnego tekstu WEB (rozdział → połączone wersety) do JSON, do użytku
 * jako grounding context przy generowaniu streszczeń rozdziałów (ollama-bible).
 * Jednorazowe narzędzie pomocnicze — nie jest częścią aplikacji produkcyjnej.
 *
 *   npx tsx scripts/export-chapter-text.ts <ścieżka-wyjściowa.json>
 */
import { writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { BOOKS } from "../shared/books";

const prisma = new PrismaClient();

async function main() {
  const outPath = process.argv[2];
  if (!outPath) throw new Error("Podaj ścieżkę pliku wyjściowego jako argument");

  const verses = await prisma.verse.findMany({
    where: { translationId: "WEB" },
    orderBy: [{ bookId: "asc" }, { chapter: "asc" }, { verse: "asc" }],
    select: { bookId: true, chapter: true, verse: true, text: true },
  });

  const byKey = new Map<string, string[]>();
  for (const v of verses) {
    const key = `${v.bookId}:${v.chapter}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(`${v.verse}. ${v.text}`);
  }

  const chapters: Record<string, string> = {};
  let missing = 0;
  for (const book of BOOKS) {
    for (let ch = 1; ch <= book.chapterCount; ch++) {
      const key = `${book.id}:${ch}`;
      const lines = byKey.get(key);
      if (!lines) {
        missing++;
        continue;
      }
      chapters[key] = lines.join(" ");
    }
  }

  const books = BOOKS.map((b) => ({
    id: b.id,
    nameEn: b.nameEn,
    chapterCount: b.chapterCount,
  }));

  await writeFile(outPath, JSON.stringify({ books, chapters }), "utf8");
  console.log(`✓ Wyeksportowano ${Object.keys(chapters).length} rozdziałów (${books.length} ksiąg) do ${outPath}`);
  if (missing) console.log(`  (brak tekstu dla ${missing} rozdziałów)`);
}

main()
  .catch((err) => {
    console.error("✗", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
