-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Paper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceType" TEXT,
    "publicationDate" DATETIME NOT NULL,
    "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiSummary" TEXT,
    "deletedAt" DATETIME,
    "relevanceScore" REAL,
    "technicalScore" REAL,
    "businessScore" REAL,
    "timelinessScore" REAL,
    "practicalityScore" REAL,
    "assessmentReason" TEXT,
    "technicalBonusApplied" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Paper" ("abstract", "aiSummary", "assessmentReason", "businessScore", "collectedAt", "deletedAt", "id", "practicalityScore", "publicationDate", "relevanceScore", "source", "sourceType", "technicalScore", "timelinessScore", "title", "url") SELECT "abstract", "aiSummary", "assessmentReason", "businessScore", "collectedAt", "deletedAt", "id", "practicalityScore", "publicationDate", "relevanceScore", "source", "sourceType", "technicalScore", "timelinessScore", "title", "url" FROM "Paper";
DROP TABLE "Paper";
ALTER TABLE "new_Paper" RENAME TO "Paper";
CREATE UNIQUE INDEX "Paper_url_key" ON "Paper"("url");
CREATE INDEX "Paper_publicationDate_idx" ON "Paper"("publicationDate");
CREATE INDEX "Paper_source_idx" ON "Paper"("source");
CREATE INDEX "Paper_url_idx" ON "Paper"("url");
CREATE INDEX "Paper_collectedAt_idx" ON "Paper"("collectedAt");
CREATE INDEX "Paper_deletedAt_idx" ON "Paper"("deletedAt");
CREATE INDEX "Paper_title_idx" ON "Paper"("title");
CREATE INDEX "Paper_sourceType_idx" ON "Paper"("sourceType");
CREATE INDEX "Paper_source_date_idx" ON "Paper"("source", "publicationDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
