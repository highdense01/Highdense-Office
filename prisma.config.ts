import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// The Prisma CLI runs outside Next.js, so it doesn't get Next's automatic
// .env.local loading — load it explicitly here.
loadEnv({ path: path.join(__dirname, ".env.local") });

// Loaded by the Prisma CLI (migrate/db push/studio) so it knows how to reach
// MySQL/MariaDB. The running app itself connects via the driver adapter in
// src/lib/db/prisma.ts — see that file for why (Prisma 7 driver-adapter model).
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
