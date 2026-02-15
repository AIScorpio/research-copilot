-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "emailAlerts" BOOLEAN NOT NULL DEFAULT false,
    "newsletterAlerts" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NotificationSubscriber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationSubscriber_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsletterLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dateCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Newsletter',
    "paperCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Paper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "publicationDate" DATETIME NOT NULL,
    "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiSummary" TEXT,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT
);

-- CreateTable
CREATE TABLE "PaperTag" (
    "paperId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("paperId", "tagId"),
    CONSTRAINT "PaperTag_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaperTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserFavorite" (
    "userId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "paperId"),
    CONSTRAINT "UserFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserFavorite_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "UserTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserTag_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'academic',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "requiresAuth" BOOLEAN NOT NULL DEFAULT false,
    "authConfig" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SocialCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "username" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SocialCredential_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrendData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tagId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "count" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrendData_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegulatoryAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "relevance" INTEGER NOT NULL DEFAULT 50,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_NewsletterLogToPaper" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_NewsletterLogToPaper_A_fkey" FOREIGN KEY ("A") REFERENCES "NewsletterLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_NewsletterLogToPaper_B_fkey" FOREIGN KEY ("B") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSubscriber_userId_email_key" ON "NotificationSubscriber"("userId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterLog_dateCode_key" ON "NewsletterLog"("dateCode");

-- CreateIndex
CREATE UNIQUE INDEX "Paper_url_key" ON "Paper"("url");

-- CreateIndex
CREATE INDEX "Paper_publicationDate_idx" ON "Paper"("publicationDate");

-- CreateIndex
CREATE INDEX "Paper_source_idx" ON "Paper"("source");

-- CreateIndex
CREATE INDEX "Paper_url_idx" ON "Paper"("url");

-- CreateIndex
CREATE INDEX "Paper_collectedAt_idx" ON "Paper"("collectedAt");

-- CreateIndex
CREATE INDEX "Paper_deletedAt_idx" ON "Paper"("deletedAt");

-- CreateIndex
CREATE INDEX "Paper_title_idx" ON "Paper"("title");

-- CreateIndex
CREATE INDEX "Paper_source_date_idx" ON "Paper"("source", "publicationDate");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "PaperTag_paperId_idx" ON "PaperTag"("paperId");

-- CreateIndex
CREATE INDEX "PaperTag_tagId_idx" ON "PaperTag"("tagId");

-- CreateIndex
CREATE INDEX "UserTag_paperId_idx" ON "UserTag"("paperId");

-- CreateIndex
CREATE UNIQUE INDEX "Source_name_key" ON "Source"("name");

-- CreateIndex
CREATE INDEX "Source_type_idx" ON "Source"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SocialCredential_sourceId_platform_key" ON "SocialCredential"("sourceId", "platform");

-- CreateIndex
CREATE INDEX "TrendData_date_idx" ON "TrendData"("date");

-- CreateIndex
CREATE INDEX "TrendData_tagId_date_idx" ON "TrendData"("tagId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TrendData_tagId_date_key" ON "TrendData"("tagId", "date");

-- CreateIndex
CREATE INDEX "RegulatoryAlert_status_createdAt_idx" ON "RegulatoryAlert"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RegulatoryAlert_priority_status_idx" ON "RegulatoryAlert"("priority", "status");

-- CreateIndex
CREATE INDEX "RegulatoryAlert_sourceId_idx" ON "RegulatoryAlert"("sourceId");

-- CreateIndex
CREATE INDEX "RegulatoryAlert_createdAt_idx" ON "RegulatoryAlert"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_NewsletterLogToPaper_AB_unique" ON "_NewsletterLogToPaper"("A", "B");

-- CreateIndex
CREATE INDEX "_NewsletterLogToPaper_B_index" ON "_NewsletterLogToPaper"("B");
