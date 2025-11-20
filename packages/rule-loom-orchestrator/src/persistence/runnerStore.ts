import { PrismaClient } from '@prisma/client';
import { disconnectPrisma, getPrismaClient } from './prismaClient.js';

export interface RunnerPersistenceRecord {
  id: string;
  basePath: string;
  configPath?: string | null;
  configContent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RunnerPersistenceInput {
  id: string;
  basePath: string;
  configPath?: string | null;
  configContent?: string | null;
}

export class RunnerStore {
  private readonly prisma: PrismaClient;
  private initialized = false;

  constructor(prismaClient: PrismaClient = getPrismaClient()) {
    this.prisma = prismaClient;
  }

  async list(): Promise<RunnerPersistenceRecord[]> {
    await this.ensureSchema();
    const records = await this.prisma.runnerConfig.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return records;
  }

  async findById(id: string): Promise<RunnerPersistenceRecord | null> {
    await this.ensureSchema();
    return this.prisma.runnerConfig.findUnique({ where: { id } });
  }

  async findByConfigPath(configPath: string): Promise<RunnerPersistenceRecord | null> {
    await this.ensureSchema();
    return this.prisma.runnerConfig.findFirst({
      where: { configPath },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(data: RunnerPersistenceInput): Promise<RunnerPersistenceRecord> {
    await this.ensureSchema();
    return this.prisma.runnerConfig.create({
      data: {
        id: data.id,
        basePath: data.basePath,
        configPath: data.configPath,
        configContent: data.configContent,
      },
    });
  }

  async update(id: string, data: RunnerPersistenceInput): Promise<RunnerPersistenceRecord> {
    await this.ensureSchema();
    return this.prisma.runnerConfig.update({
      where: { id },
      data: {
        basePath: data.basePath,
        configPath: data.configPath,
        configContent: data.configContent,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.ensureSchema();
    await this.prisma.runnerConfig.delete({ where: { id } });
  }

  async disconnect(): Promise<void> {
    await disconnectPrisma();
    this.initialized = false;
  }

  private async ensureSchema(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RunnerConfig" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "basePath" TEXT NOT NULL,
        "configPath" TEXT,
        "configContent" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      );
    `);
    await this.prisma.$executeRawUnsafe(`
      DROP INDEX IF EXISTS "RunnerConfig_configPath_key";
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "RunnerConfig_basePath_key" ON "RunnerConfig"("basePath");
    `);
    this.initialized = true;
  }
}
