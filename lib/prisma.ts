import { Prisma, PrismaClient } from '@prisma/client';

const normalizeDatabaseUrl = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('postgresql://') || trimmed.startsWith('postgres://')) {
    return trimmed;
  }

  const matchedUrl = trimmed.match(/(postgres(?:ql)?:\/\/[^'"\s]+)/i);
  return matchedUrl?.[1];
};

const normalizedDatabaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
if (normalizedDatabaseUrl) {
  process.env.DATABASE_URL = normalizedDatabaseUrl;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prismaOptions: Prisma.PrismaClientOptions = {
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  ...(normalizedDatabaseUrl
    ? {
        datasources: {
          db: {
            url: normalizedDatabaseUrl,
          },
        },
      }
    : {}),
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
