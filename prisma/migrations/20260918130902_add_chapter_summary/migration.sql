-- CreateTable
CREATE TABLE "chapter_summaries" (
    "bookId" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "textEn" TEXT NOT NULL,
    "textPl" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_summaries_pkey" PRIMARY KEY ("bookId","chapter")
);
