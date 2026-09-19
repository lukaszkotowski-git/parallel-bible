-- Dotychczasowy wybór polskiego tłumaczenia staje się tłumaczeniem „odsłanianym";
-- czytane ciągle pozostaje WEB, więc nic się użytkownikom nie zmienia.
ALTER TABLE "users" RENAME COLUMN "plTranslation" TO "altTranslation";
ALTER TABLE "users" ADD COLUMN     "readTranslation" TEXT NOT NULL DEFAULT 'WEB';
