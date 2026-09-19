/**
 * Loader Biblii Jakuba Wujka (przekład 1599, wydanie 1923 z Wikiźródeł) dla scripts/import-bible.ts.
 *
 * Źródłem jest EPUB z Wikiźródeł (pl.wikisource.org/wiki/Biblia_Wujka_(1923)), utrzymywany w repo
 * syndereza/biblia-wujka. Plik jest pobierany przez HTTP (albo czytany z WUJEK_EPUB) i parsowany
 * lokalnie — nie ma żadnych zależności poza node:zlib. Wynik ma kształt `SourceBible`, więc przechodzi
 * przez tę samą weryfikację integralności co pozostałe tłumaczenia.
 *
 * Wujek jest tłumaczeniem z Wulgaty i ma dodatkowe księgi deuterokanoniczne; importujemy tylko
 * 66 ksiąg kanonu protestanckiego, tak jak reszta aplikacji. Numeracja rozdziałów zgadza się z
 * tablicą referencyjną poza Psalmami — te w źródle mają numerację Wulgaty i są przeliczane na
 * hebrajską (patrz `psalmTarget`). Numeracja wersetów bywa przesunięta o 1–2 (tytuły psalmów,
 * pojedyncze rozbieżności) — parowanie z angielskim jest best-effort po numerze wersetu.
 */
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { BOOKS } from "../shared/books";

const EPUB_URL =
  process.env.WUJEK_EPUB_URL ??
  "https://raw.githubusercontent.com/syndereza/biblia-wujka/master/resources/Biblia_Wujka.epub";
const EPUB_PATH = process.env.WUJEK_EPUB; // lokalny plik zamiast pobierania

/** Zgodne z `SourceBible` w scripts/import-bible.ts (tylko pola, których używa import). */
interface WujekBible {
  books: {
    book: string;
    chapters: { chapter: number; verses: { number: number; text: string }[] }[];
  }[];
}

// ---- minimalny czytnik ZIP (EPUB = ZIP; wpisy są deflate lub stored) ----

function readZip(buf: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("EPUB: nie znaleziono końca archiwum ZIP");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map<string, Buffer>();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("EPUB: uszkodzony katalog ZIP");
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataStart, dataStart + csize);
    if (method === 0) files.set(name, raw);
    else if (method === 8) files.set(name, inflateRawSync(raw));
    else throw new Error(`EPUB: nieobsługiwana metoda kompresji ${method}`);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// ---- parsowanie rozdziału ----

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// Znacznik początku wersetu, w trzech wariantach kodowania numeru:
//   <span style="color:#000;" id="id-R:W"/>                (werset 1 z inicjałem)
//   <span style="color:#000;" [id="id-R:W"]><sup>W </sup></span>
//   <span style="color:#000;" id="id-R:W">W</span>         (część psalmów)
// Atrybut id, gdy jest, ma pierwszeństwo — w Ps 9 widoczne numery zaczynają się od nowa (2, 3, …),
// a id niesie ciągłą numerację Wulgaty.
const MARKER = /<span style="color:#000;"([^>]*?)(?:\/>|>(?:<sup>\s*(\d+)\.?\s*<\/sup>|(\d+))?<\/span>)/g;

/**
 * Zwraca sekcje wersetów rozdziału. Zwykły rozdział ma jedną sekcję; psalmy scalone przez
 * Wulgatę (np. 113 = 114 + 115 wg Żydów) mają kilka — nowa sekcja zaczyna się od numeru 1.
 */
function parseChapter(html: string): { number: number; text: string }[][] {
  const start = html.indexOf("prp-pages-output");
  if (start < 0) return [];
  let body = html.slice(start);
  const end = body.indexOf('<ol class="references"');
  if (end >= 0) body = body.slice(0, end);
  body = body
    .replace(/<sup id="cite_ref[^>]*>[\s\S]*?<\/sup>/g, "") // odnośniki do przypisów
    .replace(/<div[^>]*>[\s\S]*?<\/div>/g, ""); // nagłówki, streszczenia, „Psalm N według Żydów"

  const sections: { number: number; text: string }[][] = [];
  let cur: { number: number; text: string }[] | null = null;
  let last = 0;
  let open: { number: number; text: string } | null = null;
  const flush = (upto: number) => {
    if (!open) return;
    // inicjały to osobny <span>, który dzieli słowo — tagi usuwamy bez spacji, spacje dają tylko </p> i <br/>
    const raw = body.slice(last, upto).replace(/<\/p>|<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "");
    open.text = decode(raw).replace(/\s+/g, " ").trim();
  };

  for (const m of body.matchAll(MARKER)) {
    flush(m.index);
    const fromId = /id="id-\d+:(\d+)/.exec(m[1]);
    const shown = m[2] ?? m[3];
    const number = fromId ? Number(fromId[1]) : shown ? Number(shown) : NaN;
    if (Number.isNaN(number)) continue;
    if (!cur || (number === 1 && cur.length > 1)) {
      cur = [];
      sections.push(cur);
    }
    open = { number, text: "" };
    cur.push(open);
    last = m.index + m[0].length;
  }
  flush(body.length);
  return sections.map((s) => s.filter((v) => v.text));
}

/**
 * Psalmy Wulgaty → numeracja hebrajska używana przez WEB i tablicę referencyjną.
 * Zwraca [rozdział, werset] docelowy dla wersetu `v` z sekcji `section` psalmu `ps` (Wulgata).
 */
function psalmTarget(ps: number, section: number, v: number): [number, number] {
  if (ps <= 8 || ps >= 148) return [ps, v];
  if (ps === 9) return v <= 21 ? [9, v] : [10, v - 21]; // Wulgata 9 = hebr. 9 + 10
  if (ps === 113) return [section === 0 ? 114 : 115, v]; // Wulgata 113 = hebr. 114 + 115
  if (ps === 114) return [116, v]; // Wulgata 114 + 115 = hebr. 116
  if (ps === 115) return [116, v]; // źródło numeruje tu od razu 10–19
  if (ps === 146) return [147, v]; // Wulgata 146 + 147 = hebr. 147 (147 numeruje od 12)
  if (ps === 147) return [147, v];
  return [ps + 1, v]; // pozostałe: Wulgata n = hebr. n + 1
}

/** Tekst referencyjny (angielski), którego numeracja wersetów jest wzorcem dla psalmów. */
interface Reference {
  books: { book: string; chapters: { chapter: number; verses: unknown[] }[] }[];
}

/**
 * Wulgata liczy tytuł psalmu jako 1–2 osobne wersety, a WEB scala go z wersetem 1. Gdy rozdział
 * ma o 1–2 wersety więcej niż wzorzec, scalamy tyle początkowych wersetów i przesuwamy resztę.
 */
function alignPsalmTitle(vs: Map<number, string>, refCount: number | undefined): Map<number, string> {
  const d = refCount === undefined ? 0 : vs.size - refCount;
  if (d < 1 || d > 2) return vs;
  const nums = [...vs.keys()].sort((a, b) => a - b);
  const out = new Map<number, string>();
  out.set(1, nums.slice(0, d + 1).map((n) => vs.get(n)).join(" "));
  for (const n of nums.slice(d + 1)) out.set(n - d, vs.get(n)!);
  return out;
}

export async function loadWujek(reference?: Reference): Promise<WujekBible> {
  const epub = EPUB_PATH ? await readFile(EPUB_PATH) : Buffer.from(await download(EPUB_URL));
  const zip = readZip(epub);

  // Pliki: OPS/c<N>_Biblia_Wujka__1923__<Nazwa>[_<rozdział>].xhtml. Księgi bez numeru rozdziału
  // występują w kolejności kanonu (poza Testamentami); jednorozdziałowe mają tekst w pliku księgi.
  const byBook = new Map<string, { order: number; file: string; chapters: Map<number, string> }>();
  for (const name of zip.keys()) {
    const m = /(?:^|\/)c(\d+)_Biblia_Wujka__1923__(.+)\.xhtml$/.exec(name);
    if (!m || m[2].includes("Testament")) continue;
    const ch = /^(.+)_(\d+)$/.exec(m[2]);
    const bookKey = ch ? ch[1] : m[2];
    const e = byBook.get(bookKey) ?? { order: Infinity, file: "", chapters: new Map() };
    if (ch) e.chapters.set(Number(ch[2]), name);
    else {
      e.order = Number(m[1]);
      e.file = name;
    }
    byBook.set(bookKey, e);
  }
  const ordered = [...byBook.values()].filter((e) => e.file).sort((a, b) => a.order - b.order);
  if (ordered.length !== BOOKS.length) {
    throw new Error(`Wujek: znaleziono ${ordered.length} ksiąg zamiast ${BOOKS.length} — zmieniła się struktura EPUB-a?`);
  }

  const html = (name: string) => zip.get(name)!.toString("utf8");
  const books: WujekBible["books"] = [];
  for (const [i, ref] of BOOKS.entries()) {
    const src = ordered[i];
    const verses = new Map<number, Map<number, string>>(); // rozdział → werset → tekst
    const put = (ch: number, v: number, text: string) => {
      const m = verses.get(ch) ?? new Map<number, string>();
      // przy kolizji numerów (przesunięcia w źródle) zachowujemy oba fragmenty
      m.set(v, m.has(v) ? `${m.get(v)} ${text}` : text);
      verses.set(ch, m);
    };

    if (src.chapters.size === 0) {
      for (const s of parseChapter(html(src.file))) for (const v of s) put(1, v.number, v.text);
    } else {
      for (const [ch, file] of src.chapters) {
        parseChapter(html(file)).forEach((section, si) => {
          for (const v of section) {
            if (ref.id === "Ps") put(...psalmTarget(ch, si, v.number), v.text);
            else put(ch, v.number, v.text);
          }
        });
      }
    }

    if (ref.id === "Ps") {
      const refPs = reference?.books.find((b) => b.book === "Ps");
      for (const [ch, vs] of verses) {
        verses.set(ch, alignPsalmTitle(vs, refPs?.chapters.find((c) => c.chapter === ch)?.verses.length));
      }
    }

    books.push({
      book: ref.id,
      chapters: [...verses.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([chapter, vs]) => ({
          chapter,
          verses: [...vs.entries()].sort((a, b) => a[0] - b[0]).map(([number, text]) => ({ number, text })),
        })),
    });
  }
  return { books };
}

async function download(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pobieranie ${url} nie powiodło się: ${res.status}`);
  return res.arrayBuffer();
}
