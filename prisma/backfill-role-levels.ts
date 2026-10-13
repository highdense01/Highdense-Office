/**
 * One-off, non-destructive: gives the default roles their hierarchy level on an
 * existing database. Only touches roles still at level 0, so levels an admin has
 * already set are left alone, and (unlike `db:seed`) role permissions are NOT reset.
 *
 * Usage: npm run db:levels
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { DEFAULT_ROLE_LEVELS } from "../src/lib/permissions/constants";

loadEnv({ path: path.join(__dirname, "..", ".env.local") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and configure it.");
const url = new URL(databaseUrl);
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: url.password ? decodeURIComponent(url.password) : undefined,
    database: url.pathname.replace(/^\//, ""),
  }),
});

async function main() {
  for (const [name, level] of Object.entries(DEFAULT_ROLE_LEVELS)) {
    const { count } = await prisma.role.updateMany({ where: { name, level: 0 }, data: { level } });
    console.log(`${name}: ${count ? `set to level ${level}` : "unchanged (missing or already has a level)"}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
