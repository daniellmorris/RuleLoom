import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

function ensureDefaultDatabase(): void {
  if (process.env.RULE_LOOM_DATABASE_URL) {
    return;
  }
  const dataDir = path.resolve(process.cwd(), '.ruleloom');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'orchestrator.db');
  process.env.RULE_LOOM_DATABASE_URL = `file:${dbPath}`;
}

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    ensureDefaultDatabase();
    prisma = new PrismaClient();
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
