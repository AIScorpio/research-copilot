/*
  Warnings:

  - Made the column `url` on table `Source` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'academic',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "requiresAuth" BOOLEAN NOT NULL DEFAULT false,
    "authConfig" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Source" ("authConfig", "createdAt", "displayName", "enabled", "id", "name", "requiresAuth", "type", "url") SELECT "authConfig", "createdAt", "displayName", "enabled", "id", "name", "requiresAuth", "type", "url" FROM "Source";
DROP TABLE "Source";
ALTER TABLE "new_Source" RENAME TO "Source";
CREATE UNIQUE INDEX "Source_name_key" ON "Source"("name");
CREATE INDEX "Source_type_idx" ON "Source"("type");
CREATE INDEX "Source_enabled_idx" ON "Source"("enabled");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
