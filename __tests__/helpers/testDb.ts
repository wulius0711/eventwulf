import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is not set — regression tests must talk to the dedicated Neon test branch, never the dev/production DATABASE_URL."
  );
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const adapter = new PrismaPg(pool);

// Separate from lib/db.ts on purpose: that client reads DATABASE_URL, which in
// this process (the Playwright test runner, not the spawned app server) is
// never pointed at the test branch.
export const prisma = new PrismaClient({ adapter });
