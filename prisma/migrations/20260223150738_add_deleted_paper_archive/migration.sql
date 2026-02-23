-- CreateTable
CREATE TABLE "DeletedPaper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceType" TEXT,
    "publicationDate" DATETIME NOT NULL,
    "collectedAt" DATETIME NOT NULL,
    "aiSummary" TEXT,
    "relevanceScore" REAL,
    "technicalScore" REAL,
    "businessScore" REAL,
    "timelinessScore" REAL,
    "practicalityScore" REAL,
    "assessmentReason" TEXT,
    "technicalBonusApplied" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedBy" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "DeletedPaper_originalId_key" ON "DeletedPaper"("originalId");

-- CreateIndex
CREATE INDEX "DeletedPaper_deletedAt_idx" ON "DeletedPaper"("deletedAt");

-- CreateIndex
CREATE INDEX "DeletedPaper_source_idx" ON "DeletedPaper"("source");

-- CreateIndex
CREATE INDEX "DeletedPaper_originalId_idx" ON "DeletedPaper"("originalId");
