-- CreateTable
CREATE TABLE "highlights" (
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "verse" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "highlights_pkey" PRIMARY KEY ("userId","bookId","chapter","verse")
);

-- CreateTable
CREATE TABLE "verse_notes" (
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "verse" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verse_notes_pkey" PRIMARY KEY ("userId","bookId","chapter","verse")
);

-- CreateTable
CREATE TABLE "reading_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "books" TEXT[],
    "days" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "highlights_userId_bookId_chapter_idx" ON "highlights"("userId", "bookId", "chapter");

-- CreateIndex
CREATE INDEX "verse_notes_userId_bookId_chapter_idx" ON "verse_notes"("userId", "bookId", "chapter");

-- CreateIndex
CREATE INDEX "reading_plans_userId_idx" ON "reading_plans"("userId");

-- AddForeignKey
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verse_notes" ADD CONSTRAINT "verse_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_plans" ADD CONSTRAINT "reading_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

