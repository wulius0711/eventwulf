import { prisma } from "@/lib/db";

// SWITCHED OFF — audit 2026-09-26, H1: the `image` URL of an Event/Room used
// to be stored unchecked and then DELETEd from Bunny with the platform
// AccessKey, so one tenant could get another tenant's files removed (and, via
// a "?" in the value, even inject query parameters such as allowRootDelete).
// The values are validated on save now (isValidUploadedImageUrl in
// lib/validate.ts), but the delete path itself still interpolates the URL
// into the request unsanitised. The callers stay in place so this can simply
// be re-enabled once path-safe deletion lands (Phase 5); until then orphaned
// files on Bunny are cheap. Do not flip this without that change.
const BUNNY_DELETES_ENABLED: boolean = false;

// Deletes a previously-uploaded event image from Bunny storage, but only if no
// other Event row (e.g. one created via "Duplizieren") still points at the same
// URL — images can be shared between events, so this is a reference count of 1,
// not an unconditional delete.
export async function releaseEventImage(imageUrl: string, clientId: string, excludeEventId: string): Promise<void> {
  if (!BUNNY_DELETES_ENABLED) return; // see the note at the top of this file
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

// Same as releaseEventImage, but checks the Room table for remaining references.
export async function releaseRoomImage(imageUrl: string, clientId: string, excludeRoomId: string): Promise<void> {
  if (!BUNNY_DELETES_ENABLED) return; // see the note at the top of this file
  if (!imageUrl) return;

  const stillUsed = await prisma.room.findFirst({
    where: { clientId, image: imageUrl, id: { not: excludeRoomId } },
    select: { id: true },
  });
  if (stillUsed) return;

  const zone = process.env.BUNNY_STORAGE_ZONE;
  const key = process.env.BUNNY_STORAGE_KEY;
  const cdnHost = process.env.BUNNY_CDN_HOST;
  if (!zone || !key || !cdnHost) return;

  const prefix = `https://${cdnHost}/`;
  if (!imageUrl.startsWith(prefix)) return;
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
