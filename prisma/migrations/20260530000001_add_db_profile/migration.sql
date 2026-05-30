-- CreateTable
CREATE TABLE "DbProfile" (
    "id" TEXT NOT NULL,
    "productGid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "googleColorPattern" TEXT,
    "googleAuthenticity" TEXT,
    "googleRarity" TEXT,
    "googleCrystalSystem" TEXT,
    "googleGeologicalEra" TEXT,
    "googleMineralClass" TEXT,
    "googleRockComposition" TEXT,
    "googleRockFormation" TEXT,
    "storeHardness" TEXT,
    "storeLuster" TEXT,
    "storeFracture" TEXT,
    "storeCleavage" TEXT,
    "storeSpecificGravity" TEXT,
    "storeDiaphaneity" TEXT,
    "storeOriginLocation" TEXT,

    CONSTRAINT "DbProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DbProfile_productGid_key" ON "DbProfile"("productGid");
