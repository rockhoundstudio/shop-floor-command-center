-- CreateTable
CREATE TABLE "TaxonomyGid" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "gid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxonomyGid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyGid_category_term_key" ON "TaxonomyGid"("category", "term");

