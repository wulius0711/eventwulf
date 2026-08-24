import { prisma } from "@/lib/db";

// Deletes a previously-uploaded event image from Bunny storage, but only if no
// other Event row (e.g. one created via "Duplizieren") still points at the same
// URL — images can be shared between events, so this is a reference count of 1,
// not an unconditional delete.
export async function releaseEventImage(imageUrl: string, clientId: string, excludeEventId: string): Promise<void> {
  if (!imageUrl) return;

  const stillUsed = await prisma.event.findFirst({
    where: { clientId, image: imageUrl, id: { not: excludeEventId } },
    select: { id: true },
  });
  if (stillUsed) return;

  const zone = process.env.BUNNY_STORAGE_ZONE;
  const key = process.env.BUNNY_STORAGE_KEY;
  const cdnHost = process.env.BUNNY_CDN_HOST;
  if (!zone || !key || !cdnHost) return;

  const prefix = `https://${cdnHost}/`;
  if (!imageUrl.startsWith(prefix)) return; // not one of our own Bunny URLs, leave it alone
  const path = imageUrl.slice(prefix.length);

  try {
    await fetch(`https://storage.bunnycdn.com/${zone}/${path}`, {
      method: "DELETE",
      headers: { AccessKey: key },
    });
  } catch {
    // Non-critical — an orphaned file on Bunny is cheap and not worth failing the request over.
  }
}
