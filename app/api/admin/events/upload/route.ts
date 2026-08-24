import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

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

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Nur JPEG, PNG oder WebP erlaubt" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Datei zu groß (max. 5MB)" }, { status: 400 });
  }

  const path = `${session.clientSlug}/${randomBytes(12).toString("hex")}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const uploadRes = await fetch(`https://storage.bunnycdn.com/${zone}/${path}`, {
    method: "PUT",
    headers: { AccessKey: key, "Content-Type": "application/octet-stream" },
    body: buffer,
  });

  if (!uploadRes.ok) {
    return NextResponse.json({ error: "Upload fehlgeschlagen" }, { status: 502 });
  }

  return NextResponse.json({ url: `https://${cdnHost}/${path}` });
}
