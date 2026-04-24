import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashSync } from "bcryptjs";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const slug = process.env.SUPERADMIN_SLUG ?? "admin";
  const email = process.env.SEED_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_PASSWORD ?? "admin123";

  const defaultConfig = fs.readFileSync(
    path.join(process.cwd(), "config", "clients", "default.json"),
    "utf-8"
  );

  const existing = await prisma.client.findUnique({ where: { slug } });
  if (!existing) {
    await prisma.organization.create({
      data: {
        name: slug,
        clients: { create: { slug, config: defaultConfig } },
        users: { create: { email, password: hashSync(password, 12) } },
      },
    });
    console.log(`Created org + client "${slug}" with user "${email}"`);
  } else {
    console.log(`Client "${slug}" already exists — skipping seed`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
