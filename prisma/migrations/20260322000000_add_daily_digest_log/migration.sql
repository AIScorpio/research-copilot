-- Migration: Add Daily Digest Log tables
-- Created: 2026-03-22

-- Create DailyDigestLog table
CREATE TABLE "DailyDigestLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dateCode" TEXT NOT NULL UNIQUE,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'DailyDigest',
    "actualCount" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "qualityScore" REAL,
    "validationIssues" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Create indexes for DailyDigestLog
CREATE INDEX "DailyDigestLog_dateCode_idx" ON "DailyDigestLog"("dateCode");
CREATE INDEX "DailyDigestLog_createdAt_idx" ON "DailyDigestLog"("createdAt");
CREATE INDEX "DailyDigestLog_status_idx" ON "DailyDigestLog"("status");

-- Create DigestGenerationLock table
CREATE TABLE "DigestGenerationLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dateCode" TEXT NOT NULL UNIQUE,
    "lockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- Create indexes for DigestGenerationLock
CREATE INDEX "DigestGenerationLock_dateCode_idx" ON "DigestGenerationLock"("dateCode");
CREATE INDEX "DigestGenerationLock_expiresAt_idx" ON "DigestGenerationLock"("expiresAt");

-- Create junction table for DailyDigestLog to Paper relationship
CREATE TABLE "_DailyDigestToPaper" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    FOREIGN KEY ("A") REFERENCES "DailyDigestLog"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("B") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create unique index on junction table
CREATE UNIQUE INDEX "_DailyDigestToPaper_AB_unique" ON "_DailyDigestToPaper"("A", "B");

-- Create index on junction table
CREATE INDEX "_DailyDigestToPaper_B_index" ON "_DailyDigestToPaper"("B");

-- Add deletedAt column to Paper table
ALTER TABLE "Paper" ADD COLUMN "deletedAt" DATETIME;

-- Create index on Paper.deletedAt
CREATE INDEX "Paper_deletedAt_idx" ON "Paper"("deletedAt");
