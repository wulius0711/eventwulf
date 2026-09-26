import { test, expect } from "@playwright/test";
import { randomBytes } from "crypto";
import { prisma } from "../helpers/testDb";
import {
  createTestClientWithAdmin,
  createTestEvent,
  createTestRoom,
  deleteTestOrganization,
  isoDateInDays,
  loginAsTestAdmin,
} from "../helpers/fixtures";

// Regression test for audit 2026-09-26, H1 (part 1): Event/Room `image` was
// stored unchecked and later DELETEd from Bunny with the platform AccessKey,
// so one tenant could point its image at another tenant's file (or at
// "?allowRootDelete=true") and have it removed. The server now accepts only ""
// or `https://<BUNNY_CDN_HOST>/<own slug>/<24 lowercase hex>.(webp|jpg|jpeg|png)`.
//
// Deliberately uses a fresh event/room per case and never replaces or deletes
// through the API: on code without the fix an accepted malicious value would
// otherwise be deleted from Bunny by the *next* PATCH. Run with dummy BUNNY_*
// env vars (the spawned server inherits process.env), never the real ones.
const CDN_HOST = process.env.BUNNY_CDN_HOST;
const hex24 = () => randomBytes(12).toString("hex");

test.describe("Event/Room image URLs are validated per tenant", () => {
  test.skip(!CDN_HOST, "BUNNY_CDN_HOST not set — image validation cannot be exercised");
  test.describe.configure({ mode: "serial" });

  let a: Awaited<ReturnType<typeof createTestClientWithAdmin>>;
  let b: Awaited<ReturnType<typeof createTestClientWithAdmin>>;
  let slugA: string;
  let slugB: string;

  test.beforeAll(async () => {
    a = await createTestClientWithAdmin();
    b = await createTestClientWithAdmin();
    // Premium: Rooms are Pro+, and Basis/Pro cap active events/rooms.
    await prisma.organization.update({ where: { id: a.organization.id }, data: { plan: "premium" } });
    slugA = a.client.slug;
    slugB = b.client.slug;
  });

  test.afterAll(async () => {
    await deleteTestOrganization(a.organization.id, a.client.id);
    await deleteTestOrganization(b.organization.id, b.client.id);
  });

  test.beforeEach(async ({ request }) => {
    await loginAsTestAdmin(request, a.email, a.password);
  });

  function badImages(): Record<string, unknown> {
    const good = `https://${CDN_HOST}/${slugA}/${hex24()}.webp`;
    return {
      "another tenant's file": `https://${CDN_HOST}/${slugB}/${hex24()}.webp`,
      "another tenant's directory": `https://${CDN_HOST}/${slugB}/`,
      "path traversal into another tenant": `https://${CDN_HOST}/${slugA}/../${slugB}/${hex24()}.webp`,
      "encoded path traversal": `https://${CDN_HOST}/${slugA}/%2e%2e/${slugB}/${hex24()}.webp`,
      "query string": `${good}?x=1`,
      "zone-root query injection": `https://${CDN_HOST}/?allowRootDelete=true`,
      "own path with allowRootDelete": `${good}?allowRootDelete=true`,
      "fragment": `${good}#x`,
      "trailing slash after file": `${good}/`,
      "own directory (trailing slash)": `https://${CDN_HOST}/${slugA}/`,
      "own directory (no slash)": `https://${CDN_HOST}/${slugA}`,
      "zone root": `https://${CDN_HOST}/`,
      "uppercase extension": `https://${CDN_HOST}/${slugA}/${hex24()}.WEBP`,
      "uppercase hex": `https://${CDN_HOST}/${slugA}/${hex24().toUpperCase()}.webp`,
      "23 hex chars": `https://${CDN_HOST}/${slugA}/${hex24().slice(1)}.webp`,
      "25 hex chars": `https://${CDN_HOST}/${slugA}/${hex24()}0.webp`,
      "non-hex characters": `https://${CDN_HOST}/${slugA}/${"z".repeat(24)}.webp`,
      "disallowed extension gif": `https://${CDN_HOST}/${slugA}/${hex24()}.gif`,
      "double extension": `https://${CDN_HOST}/${slugA}/${hex24()}.webp.exe`,
      "trailing newline": `${good}\n`,
      "foreign host": `https://evil.example/${slugA}/${hex24()}.webp`,
      "cdn host as subdomain prefix": `https://${CDN_HOST}.evil.example/${slugA}/${hex24()}.webp`,
      "http scheme": `http://${CDN_HOST}/${slugA}/${hex24()}.webp`,
      "number": 123,
      "object": { url: good },
      "array": [good],
    };
  }

  for (const kind of ["event", "room"] as const) {
    const api = kind === "event" ? "/api/admin/events" : "/api/admin/rooms";
    const create = (image: unknown) =>
      kind === "event"
        ? { name: "Img Test", startDate: isoDateInDays(30), endDate: isoDateInDays(31), image }
        : { name: "Img Test", image };
    const makeExisting = async (image = "") => {
      const row = kind === "event" ? await createTestEvent(a.client.id) : await createTestRoom(a.client.id);
      if (image) {
        await (kind === "event"
          ? prisma.event.update({ where: { id: row.id }, data: { image } })
          : prisma.room.update({ where: { id: row.id }, data: { image } }));
      }
      return row;
    };

    test(`${kind}: every malformed or foreign image URL is rejected on POST and PATCH`, async ({ request }) => {
      for (const [label, image] of Object.entries(badImages())) {
        const posted = await request.post(api, { data: create(image) });
        expect(posted.status(), `POST with ${label}`).toBe(400);

        const row = await makeExisting();
        const patched = await request.patch(api, { data: { id: row.id, image } });
        expect(patched.status(), `PATCH with ${label}`).toBe(400);

        // The row must be untouched, not just the response an error.
        const after = kind === "event"
          ? await prisma.event.findUnique({ where: { id: row.id } })
          : await prisma.room.findUnique({ where: { id: row.id } });
        expect(after?.image, `stored image after PATCH with ${label}`).toBe("");
      }
    });

    test(`${kind}: empty and own upload-format URLs are accepted`, async ({ request }) => {
      for (const image of [
        "",
        `https://${CDN_HOST}/${slugA}/${hex24()}.webp`,
        `https://${CDN_HOST}/${slugA}/${hex24()}.jpg`,
        `https://${CDN_HOST}/${slugA}/${hex24()}.jpeg`,
        `https://${CDN_HOST}/${slugA}/${hex24()}.png`,
      ]) {
        const posted = await request.post(api, { data: create(image) });
        expect(posted.status(), `POST with "${image}"`).toBe(200);
        expect((await posted.json()).image).toBe(image);

        const row = await makeExisting();
        const patched = await request.patch(api, { data: { id: row.id, image } });
        expect(patched.status(), `PATCH with "${image}"`).toBe(200);
      }
    });

    test(`${kind}: a PATCH without an image field keeps the stored image`, async ({ request }) => {
      const image = `https://${CDN_HOST}/${slugA}/${hex24()}.webp`;
      const row = await makeExisting(image);
      const patched = await request.patch(api, { data: { id: row.id, name: "Renamed" } });
      expect(patched.status()).toBe(200);
      expect((await patched.json()).image).toBe(image);
    });

    test(`${kind}: an existing legacy .jpg image can be edited and duplicated`, async ({ request }) => {
      const legacy = `https://${CDN_HOST}/${slugA}/${hex24()}.jpg`;
      const row = await makeExisting(legacy);

      // What the editor sends on "Speichern": the whole form, image round-tripped.
      const edited = await request.patch(api, { data: { id: row.id, name: "Edited", image: legacy } });
      expect(edited.status()).toBe(200);
      expect((await edited.json()).image).toBe(legacy);

      // What "Duplizieren" sends: a POST carrying the same image.
      const duplicated = await request.post(api, { data: { ...create(legacy), name: "Edited (Kopie)" } });
      expect(duplicated.status()).toBe(200);
      expect((await duplicated.json()).image).toBe(legacy);
    });
  }
});
