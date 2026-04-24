import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

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
    const client = await prisma.client.create({
      data: { slug, config: defaultConfig },
    });
    await prisma.user.create({
      data: {
        email,
        password: hashSync(password, 12),
        clientId: client.id,
      },
    });
    console.log(`Created client "${slug}" with user "${email}"`);
  } else {
    console.log(`Client "${slug}" already exists — skipping seed`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
