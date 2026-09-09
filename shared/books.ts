// Kanon 66 ksiąg — tablica referencyjna używana przez import (weryfikacja integralności)
// oraz przez UI (skrócone nazwy w siatce ksiąg).
// Kolejność i liczby rozdziałów są sprawdzane przy imporcie: 66 ksiąg / 1189 rozdziałów.

export type Testament = "OT" | "NT";

export interface BookRef {
  id: string; // identyfikator OSIS-like, zgodny z nazwami plików w źródle danych
  namePl: string;
  shortPl: string;
  nameEn: string;
  testament: Testament;
  sortOrder: number;
  chapterCount: number;
}

export const BOOKS: BookRef[] = [
  { id: "Gen", namePl: "Księga Rodzaju", shortPl: "Rodzaju", nameEn: "Genesis", testament: "OT", sortOrder: 1, chapterCount: 50 },
  { id: "Exod", namePl: "Księga Wyjścia", shortPl: "Wyjścia", nameEn: "Exodus", testament: "OT", sortOrder: 2, chapterCount: 40 },
  { id: "Lev", namePl: "Księga Kapłańska", shortPl: "Kapłańska", nameEn: "Leviticus", testament: "OT", sortOrder: 3, chapterCount: 27 },
  { id: "Num", namePl: "Księga Liczb", shortPl: "Liczb", nameEn: "Numbers", testament: "OT", sortOrder: 4, chapterCount: 36 },
  { id: "Deut", namePl: "Księga Powtórzonego Prawa", shortPl: "Powt. Prawa", nameEn: "Deuteronomy", testament: "OT", sortOrder: 5, chapterCount: 34 },
  { id: "Josh", namePl: "Księga Jozuego", shortPl: "Jozuego", nameEn: "Joshua", testament: "OT", sortOrder: 6, chapterCount: 24 },
  { id: "Judg", namePl: "Księga Sędziów", shortPl: "Sędziów", nameEn: "Judges", testament: "OT", sortOrder: 7, chapterCount: 21 },
  { id: "Ruth", namePl: "Księga Rut", shortPl: "Rut", nameEn: "Ruth", testament: "OT", sortOrder: 8, chapterCount: 4 },
  { id: "1Sam", namePl: "1 Księga Samuela", shortPl: "1 Samuela", nameEn: "1 Samuel", testament: "OT", sortOrder: 9, chapterCount: 31 },
  { id: "2Sam", namePl: "2 Księga Samuela", shortPl: "2 Samuela", nameEn: "2 Samuel", testament: "OT", sortOrder: 10, chapterCount: 24 },
  { id: "1Kgs", namePl: "1 Księga Królewska", shortPl: "1 Królewska", nameEn: "1 Kings", testament: "OT", sortOrder: 11, chapterCount: 22 },
  { id: "2Kgs", namePl: "2 Księga Królewska", shortPl: "2 Królewska", nameEn: "2 Kings", testament: "OT", sortOrder: 12, chapterCount: 25 },
  { id: "1Chr", namePl: "1 Księga Kronik", shortPl: "1 Kronik", nameEn: "1 Chronicles", testament: "OT", sortOrder: 13, chapterCount: 29 },
  { id: "2Chr", namePl: "2 Księga Kronik", shortPl: "2 Kronik", nameEn: "2 Chronicles", testament: "OT", sortOrder: 14, chapterCount: 36 },
  { id: "Ezra", namePl: "Księga Ezdrasza", shortPl: "Ezdrasza", nameEn: "Ezra", testament: "OT", sortOrder: 15, chapterCount: 10 },
  { id: "Neh", namePl: "Księga Nehemiasza", shortPl: "Nehemiasza", nameEn: "Nehemiah", testament: "OT", sortOrder: 16, chapterCount: 13 },
  { id: "Esth", namePl: "Księga Estery", shortPl: "Estery", nameEn: "Esther", testament: "OT", sortOrder: 17, chapterCount: 10 },
  { id: "Job", namePl: "Księga Hioba", shortPl: "Hioba", nameEn: "Job", testament: "OT", sortOrder: 18, chapterCount: 42 },
  { id: "Ps", namePl: "Księga Psalmów", shortPl: "Psalmy", nameEn: "Psalms", testament: "OT", sortOrder: 19, chapterCount: 150 },
  { id: "Prov", namePl: "Księga Przysłów", shortPl: "Przysłów", nameEn: "Proverbs", testament: "OT", sortOrder: 20, chapterCount: 31 },
  { id: "Eccl", namePl: "Księga Koheleta", shortPl: "Kohelet", nameEn: "Ecclesiastes", testament: "OT", sortOrder: 21, chapterCount: 12 },
  { id: "Song", namePl: "Pieśń nad Pieśniami", shortPl: "Pieśń nad P.", nameEn: "Song of Solomon", testament: "OT", sortOrder: 22, chapterCount: 8 },
  { id: "Isa", namePl: "Księga Izajasza", shortPl: "Izajasza", nameEn: "Isaiah", testament: "OT", sortOrder: 23, chapterCount: 66 },
  { id: "Jer", namePl: "Księga Jeremiasza", shortPl: "Jeremiasza", nameEn: "Jeremiah", testament: "OT", sortOrder: 24, chapterCount: 52 },
  { id: "Lam", namePl: "Lamentacje Jeremiasza", shortPl: "Lamentacje", nameEn: "Lamentations", testament: "OT", sortOrder: 25, chapterCount: 5 },
  { id: "Ezek", namePl: "Księga Ezechiela", shortPl: "Ezechiela", nameEn: "Ezekiel", testament: "OT", sortOrder: 26, chapterCount: 48 },
  { id: "Dan", namePl: "Księga Daniela", shortPl: "Daniela", nameEn: "Daniel", testament: "OT", sortOrder: 27, chapterCount: 12 },
  { id: "Hos", namePl: "Księga Ozeasza", shortPl: "Ozeasza", nameEn: "Hosea", testament: "OT", sortOrder: 28, chapterCount: 14 },
  { id: "Joel", namePl: "Księga Joela", shortPl: "Joela", nameEn: "Joel", testament: "OT", sortOrder: 29, chapterCount: 3 },
  { id: "Amos", namePl: "Księga Amosa", shortPl: "Amosa", nameEn: "Amos", testament: "OT", sortOrder: 30, chapterCount: 9 },
  { id: "Obad", namePl: "Księga Abdiasza", shortPl: "Abdiasza", nameEn: "Obadiah", testament: "OT", sortOrder: 31, chapterCount: 1 },
  { id: "Jonah", namePl: "Księga Jonasza", shortPl: "Jonasza", nameEn: "Jonah", testament: "OT", sortOrder: 32, chapterCount: 4 },
  { id: "Mic", namePl: "Księga Micheasza", shortPl: "Micheasza", nameEn: "Micah", testament: "OT", sortOrder: 33, chapterCount: 7 },
  { id: "Nah", namePl: "Księga Nahuma", shortPl: "Nahuma", nameEn: "Nahum", testament: "OT", sortOrder: 34, chapterCount: 3 },
  { id: "Hab", namePl: "Księga Habakuka", shortPl: "Habakuka", nameEn: "Habakkuk", testament: "OT", sortOrder: 35, chapterCount: 3 },
  { id: "Zeph", namePl: "Księga Sofoniasza", shortPl: "Sofoniasza", nameEn: "Zephaniah", testament: "OT", sortOrder: 36, chapterCount: 3 },
  { id: "Hag", namePl: "Księga Aggeusza", shortPl: "Aggeusza", nameEn: "Haggai", testament: "OT", sortOrder: 37, chapterCount: 2 },
  { id: "Zech", namePl: "Księga Zachariasza", shortPl: "Zachariasza", nameEn: "Zechariah", testament: "OT", sortOrder: 38, chapterCount: 14 },
  { id: "Mal", namePl: "Księga Malachiasza", shortPl: "Malachiasza", nameEn: "Malachi", testament: "OT", sortOrder: 39, chapterCount: 4 },
  { id: "Matt", namePl: "Ewangelia Mateusza", shortPl: "Mateusza", nameEn: "Matthew", testament: "NT", sortOrder: 40, chapterCount: 28 },
  { id: "Mark", namePl: "Ewangelia Marka", shortPl: "Marka", nameEn: "Mark", testament: "NT", sortOrder: 41, chapterCount: 16 },
  { id: "Luke", namePl: "Ewangelia Łukasza", shortPl: "Łukasza", nameEn: "Luke", testament: "NT", sortOrder: 42, chapterCount: 24 },
  { id: "John", namePl: "Ewangelia Jana", shortPl: "Jana", nameEn: "John", testament: "NT", sortOrder: 43, chapterCount: 21 },
  { id: "Acts", namePl: "Dzieje Apostolskie", shortPl: "Dzieje", nameEn: "Acts", testament: "NT", sortOrder: 44, chapterCount: 28 },
  { id: "Rom", namePl: "List do Rzymian", shortPl: "Rzymian", nameEn: "Romans", testament: "NT", sortOrder: 45, chapterCount: 16 },
  { id: "1Cor", namePl: "1 List do Koryntian", shortPl: "1 Koryntian", nameEn: "1 Corinthians", testament: "NT", sortOrder: 46, chapterCount: 16 },
  { id: "2Cor", namePl: "2 List do Koryntian", shortPl: "2 Koryntian", nameEn: "2 Corinthians", testament: "NT", sortOrder: 47, chapterCount: 13 },
  { id: "Gal", namePl: "List do Galatów", shortPl: "Galatów", nameEn: "Galatians", testament: "NT", sortOrder: 48, chapterCount: 6 },
  { id: "Eph", namePl: "List do Efezjan", shortPl: "Efezjan", nameEn: "Ephesians", testament: "NT", sortOrder: 49, chapterCount: 6 },
  { id: "Phil", namePl: "List do Filipian", shortPl: "Filipian", nameEn: "Philippians", testament: "NT", sortOrder: 50, chapterCount: 4 },
  { id: "Col", namePl: "List do Kolosan", shortPl: "Kolosan", nameEn: "Colossians", testament: "NT", sortOrder: 51, chapterCount: 4 },
  { id: "1Thess", namePl: "1 List do Tesaloniczan", shortPl: "1 Tesalonicz.", nameEn: "1 Thessalonians", testament: "NT", sortOrder: 52, chapterCount: 5 },
  { id: "2Thess", namePl: "2 List do Tesaloniczan", shortPl: "2 Tesalonicz.", nameEn: "2 Thessalonians", testament: "NT", sortOrder: 53, chapterCount: 3 },
  { id: "1Tim", namePl: "1 List do Tymoteusza", shortPl: "1 Tymoteusza", nameEn: "1 Timothy", testament: "NT", sortOrder: 54, chapterCount: 6 },
  { id: "2Tim", namePl: "2 List do Tymoteusza", shortPl: "2 Tymoteusza", nameEn: "2 Timothy", testament: "NT", sortOrder: 55, chapterCount: 4 },
  { id: "Titus", namePl: "List do Tytusa", shortPl: "Tytusa", nameEn: "Titus", testament: "NT", sortOrder: 56, chapterCount: 3 },
  { id: "Phlm", namePl: "List do Filemona", shortPl: "Filemona", nameEn: "Philemon", testament: "NT", sortOrder: 57, chapterCount: 1 },
  { id: "Heb", namePl: "List do Hebrajczyków", shortPl: "Hebrajczyków", nameEn: "Hebrews", testament: "NT", sortOrder: 58, chapterCount: 13 },
  { id: "Jas", namePl: "List Jakuba", shortPl: "Jakuba", nameEn: "James", testament: "NT", sortOrder: 59, chapterCount: 5 },
  { id: "1Pet", namePl: "1 List Piotra", shortPl: "1 Piotra", nameEn: "1 Peter", testament: "NT", sortOrder: 60, chapterCount: 5 },
  { id: "2Pet", namePl: "2 List Piotra", shortPl: "2 Piotra", nameEn: "2 Peter", testament: "NT", sortOrder: 61, chapterCount: 3 },
  { id: "1John", namePl: "1 List Jana", shortPl: "1 Jana", nameEn: "1 John", testament: "NT", sortOrder: 62, chapterCount: 5 },
  { id: "2John", namePl: "2 List Jana", shortPl: "2 Jana", nameEn: "2 John", testament: "NT", sortOrder: 63, chapterCount: 1 },
  { id: "3John", namePl: "3 List Jana", shortPl: "3 Jana", nameEn: "3 John", testament: "NT", sortOrder: 64, chapterCount: 1 },
  { id: "Jude", namePl: "List Judy", shortPl: "Judy", nameEn: "Jude", testament: "NT", sortOrder: 65, chapterCount: 1 },
  { id: "Rev", namePl: "Apokalipsa św. Jana", shortPl: "Apokalipsa", nameEn: "Revelation", testament: "NT", sortOrder: 66, chapterCount: 22 },
];

export const TOTAL_BOOKS = BOOKS.length; // 66
export const TOTAL_CHAPTERS = BOOKS.reduce((sum, b) => sum + b.chapterCount, 0); // 1189

export const BOOK_BY_ID: Record<string, BookRef> = Object.fromEntries(
  BOOKS.map((b) => [b.id, b]),
);
