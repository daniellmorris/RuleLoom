-- CreateTable
CREATE TABLE "RunnerConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "basePath" TEXT NOT NULL,
    "configPath" TEXT,
    "configContent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "RunnerConfig_configPath_key" ON "RunnerConfig"("configPath");

-- CreateIndex
CREATE UNIQUE INDEX "RunnerConfig_basePath_key" ON "RunnerConfig"("basePath");
