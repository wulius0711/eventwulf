// One-off: download stock images, optimize them the same way the real upload
// route does, push to Bunny CDN, and point the demo client's rooms/events at
// the resulting CDN URLs (the widget's CSP only allows img-src from our own
// CDN, not arbitrary hotlinked hosts).
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import sharp from "sharp";
import { randomBytes } from "crypto";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const zone = process.env.BUNNY_STORAGE_ZONE!;
const key = process.env.BUNNY_STORAGE_KEY!;
const cdnHost = process.env.BUNNY_CDN_HOST!;

async function uploadImage(sourceUrl: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Failed to fetch ${sourceUrl}: ${res.status}`);
  const original = Buffer.from(await res.arrayBuffer());
  const optimized = await sharp(original).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();

  const path = `demo/${randomBytes(12).toString("hex")}.webp`;
  const uploadRes = await fetch(`https://storage.bunnycdn.com/${zone}/${path}`, {
    method: "PUT",
    headers: { AccessKey: key, "Content-Type": "application/octet-stream" },
    body: new Uint8Array(optimized),
  });
  if (!uploadRes.ok) throw new Error(`Bunny upload failed: ${uploadRes.status}`);
  return `https://${cdnHost}/${path}`;
}

async function main() {
  const client = await prisma.client.findUnique({ where: { slug: "demo" } });
  if (!client) throw new Error("Demo client not found");

  const seminarraumUrl = await uploadImage("https://images.unsplash.com/photo-1517502884422-41eaead166d4?w=1200&q=80");
  await prisma.room.updateMany({ where: { clientId: client.id, name: "Seminarraum Alm" }, data: { image: seminarraumUrl } });
  console.log("Seminarraum Alm ->", seminarraumUrl);

  const scheuneUrl = await uploadImage("https://images.unsplash.com/photo-1761971975962-9cc397e2ba2a?w=1200&q=80");
  await prisma.room.updateMany({ where: { clientId: client.id, name: "Yoga-Scheune" }, data: { image: scheuneUrl } });
  console.log("Yoga-Scheune ->", scheuneUrl);

  const yogaUrl = await uploadImage("https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&q=80");
  await prisma.event.updateMany({ where: { clientId: client.id, name: "Yoga-Wochenende" }, data: { image: yogaUrl } });
  console.log("Yoga-Wochenende ->", yogaUrl);

  const businessUrl = await uploadImage("https://images.unsplash.com/photo-1552581234-26160f608093?w=1200&q=80");
  await prisma.event.updateMany({ where: { clientId: client.id, name: { contains: "Business-Seminar" } }, data: { image: businessUrl } });
  console.log("Business-Seminar ->", businessUrl);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
