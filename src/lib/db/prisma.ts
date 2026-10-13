import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * Prisma 7 requires an explicit driver adapter instead of reading the
 * datasource `url` at runtime. DATABASE_URL stays in the standard
 * mysql://user:pass@host:port/db form (see .env.example) — the `mariadb`
 * driver only parses its own mariadb:// scheme, so we parse the URL
 * ourselves rather than asking developers to use a non-standard scheme.
 */
function poolConfigFromDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: url.password ? decodeURIComponent(url.password) : undefined,
    database: url.pathname.replace(/^\//, ""),
  };
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and configure it.");
  }

  const adapter = new PrismaMariaDb(poolConfigFromDatabaseUrl(databaseUrl));

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
