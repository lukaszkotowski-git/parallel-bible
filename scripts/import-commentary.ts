/**
 * Import streszczeń rozdziałów (PL/EN) wygenerowanych offline (ollama-bible) do tabeli
 * chapter_summaries. Idempotentny upsert — bezpieczny do ponownego uruchomienia,
 * także w trakcie trwania generowania (dogrywa kolejne wiersze pliku).
 *
 *   npx tsx scripts/import-commentary.ts <ścieżka-do-bible_summaries.jsonl> [nazwa-modelu]
 */
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { BOOK_BY_ID } from "../shared/books";

const prisma = new PrismaClient();

interface Row {
  bookId: string;
  chapter: number;
  textEn: string;
  textPl: string;
}

async function main() {
  const filePath = process.argv[2];
  const modelName = process.argv[3] ?? "llama3.1:8b";
  if (!filePath) throw new Error("Podaj ścieżkę do pliku .jsonl jako argument");

  const raw = await readFile(filePath, "utf8");
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  let ok = 0;
  let skipped = 0;
  const problems: string[] = [];

  for (const line of lines) {
    let row: Row;
    try {
      row = JSON.parse(line);
    } catch {
      skipped++;
      continue;
    }
    if (!row.bookId || !row.chapter || !row.textEn || !row.textPl) {
      skipped++;
      continue;
    }
    const ref = BOOK_BY_ID[row.bookId];
    if (!ref) {
      problems.push(`nieznana księga "${row.bookId}"`);
      skipped++;
      continue;
    }
    if (row.chapter < 1 || row.chapter > ref.chapterCount) {
      problems.push(`${row.bookId} ${row.chapter}: poza zakresem (max ${ref.chapterCount})`);
      skipped++;
      continue;
    }

    await prisma.chapterSummary.upsert({
      where: { bookId_chapter: { bookId: row.bookId, chapter: row.chapter } },
      update: { textEn: row.textEn, textPl: row.textPl, model: modelName },
      create: { bookId: row.bookId, chapter: row.chapter, textEn: row.textEn, textPl: row.textPl, model: modelName },
    });
    ok++;
  }

  console.log(`✓ Zaimportowano/zaktualizowano ${ok} streszczeń, pominięto ${skipped}`);
  if (problems.length) console.log(`  problemy:\n  - ${problems.slice(0, 20).join("\n  - ")}`);

  const total = await prisma.chapterSummary.count();
  console.log(`  łącznie w bazie: ${total} / 1189`);
}

main()
  .catch((err) => {
    console.error("✗", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
