-- CreateTable
CREATE TABLE "LLMProviderBase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isCloud" BOOLEAN NOT NULL DEFAULT true,
    "baseUrl" TEXT,
    "docsUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LLMModelBase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contextWindow" INTEGER,
    "capabilities" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LLMModelBase_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LLMProviderBase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserLLMConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT,
    "baseUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'untested',
    "errorMessage" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "UserLLMConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserLLMConfig_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LLMProviderBase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserLLMModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userConfigId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "temperature" REAL,
    "maxTokens" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserLLMModel_userConfigId_fkey" FOREIGN KEY ("userConfigId") REFERENCES "UserLLMConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserLLMModel_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "LLMModelBase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LLMProviderBase_type_key" ON "LLMProviderBase"("type");

-- CreateIndex
CREATE INDEX "LLMProviderBase_type_idx" ON "LLMProviderBase"("type");

-- CreateIndex
CREATE INDEX "LLMProviderBase_isCloud_idx" ON "LLMProviderBase"("isCloud");

-- CreateIndex
CREATE INDEX "LLMModelBase_providerId_idx" ON "LLMModelBase"("providerId");

-- CreateIndex
CREATE INDEX "LLMModelBase_isActive_idx" ON "LLMModelBase"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LLMModelBase_providerId_externalId_key" ON "LLMModelBase"("providerId", "externalId");

-- CreateIndex
CREATE INDEX "UserLLMConfig_userId_idx" ON "UserLLMConfig"("userId");

-- CreateIndex
CREATE INDEX "UserLLMConfig_providerId_idx" ON "UserLLMConfig"("providerId");

-- CreateIndex
CREATE INDEX "UserLLMConfig_status_idx" ON "UserLLMConfig"("status");

-- CreateIndex
CREATE INDEX "UserLLMConfig_priority_idx" ON "UserLLMConfig"("priority");

-- CreateIndex
CREATE INDEX "UserLLMConfig_isEnabled_idx" ON "UserLLMConfig"("isEnabled");

-- CreateIndex
CREATE INDEX "UserLLMConfig_deletedAt_idx" ON "UserLLMConfig"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserLLMConfig_userId_providerId_name_key" ON "UserLLMConfig"("userId", "providerId", "name");

-- CreateIndex
CREATE INDEX "UserLLMModel_userConfigId_idx" ON "UserLLMModel"("userConfigId");

-- CreateIndex
CREATE INDEX "UserLLMModel_modelId_idx" ON "UserLLMModel"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLLMModel_userConfigId_modelId_key" ON "UserLLMModel"("userConfigId", "modelId");
