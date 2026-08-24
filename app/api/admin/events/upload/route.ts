import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import sharp from "sharp";
import { getSession } from "@/lib/auth";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5MB, checked before resizing
const MAX_WIDTH = 1200; // enough for a ~600px-wide card at 2x retina

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const zone = process.env.BUNNY_STORAGE_ZONE;
  const key = process.env.BUNNY_STORAGE_KEY;
  const cdnHost = process.env.BUNNY_CDN_HOST;
  if (!zone || !key || !cdnHost) {
    return NextResponse.json({ error: "Bild-Upload ist nicht konfiguriert" }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei übermittelt" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Nur JPEG, PNG oder WebP erlaubt" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Datei zu groß (max. 5MB)" }, { status: 400 });
  }

  // Every upload is normalized to WebP and capped at MAX_WIDTH — the original
  // format/resolution don't matter for a fixed-aspect card thumbnail, and this
  // keeps CDN payloads small regardless of what the admin uploads.
  const original = Buffer.from(await file.arrayBuffer());
  let optimized: Buffer;
  try {
    optimized = await sharp(original)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Bild konnte nicht verarbeitet werden" }, { status: 400 });
  }

  const path = `${session.clientSlug}/${randomBytes(12).toString("hex")}.webp`;

  const uploadRes = await fetch(`https://storage.bunnycdn.com/${zone}/${path}`, {
    method: "PUT",
    headers: { AccessKey: key, "Content-Type": "application/octet-stream" },
    body: new Uint8Array(optimized),
  });

  if (!uploadRes.ok) {
    return NextResponse.json({ error: "Upload fehlgeschlagen" }, { status: 502 });
  }

  return NextResponse.json({ url: `https://${cdnHost}/${path}` });
}
