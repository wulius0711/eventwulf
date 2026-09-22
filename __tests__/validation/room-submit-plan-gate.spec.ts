import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, createTestRoom, deleteTestOrganization, isoDateInDays } from "../helpers/fixtures";

// Regression test for the Rooms hasFeature() write-path gap: the public
// read path (app/api/rooms/route.ts) already hides rooms from a
// downgraded org's picker, but /api/submit never re-checked the feature
// gate on write — a roomId submitted directly (bypassing the picker/UI
// entirely, e.g. a stale cached page or a direct API call) was silently
// accepted and booked regardless of the org's current plan. Fixed by
// clamping roomId to undefined, once, right after resolving the org's
// plan — before any of the several places that used to read
// body.roomId independently (validation, availability check, the Inquiry
// insert, and the hold-expiry flag).
test.describe("Rooms plan gate on the write path (/api/submit)", () => {
  function payload(client: { slug: string }, roomId: string) {
    return {
      slug: client.slug,
      roomId,
      artTitel: "Room Gate Test",
      nameGruppenleitung: "Tester",
      email: "guest@example.com",
      datumVon: isoDateInDays(30),
      datumBis: isoDateInDays(30),
      personenAnzahl: "5",
    };
  }

  test("a roomId submitted while the org is on Basis (rooms locked) is silently ignored — booking succeeds without a room", async ({ request }) => {
    const org = await createTestClientWithAdmin();
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "basis" } });
    const room = await createTestRoom(org.client.id, { name: "Locked Room" });

    try {
      const res = await request.post("/api/submit", { data: payload(org.client, room.id) });
      // /api/submit's success response is just { ok: true } — no id to key
      // off, so the DB is the source of truth for what actually got saved,
      // same as room-advisory-lock.spec.ts's assertions.
      expect(res.status()).toBe(200);

      const inquiryForRoom = await prisma.inquiry.findFirst({ where: { clientId: org.client.id, roomId: room.id } });
      expect(inquiryForRoom).toBeNull();

      const savedInquiry = await prisma.inquiry.findFirst({ where: { clientId: org.client.id } });
      expect(savedInquiry).not.toBeNull();
      expect(savedInquiry?.roomId).toBeNull();
    } finally {
      await deleteTestOrganization(org.organization.id, org.client.id);
    }
  });

  test("the same submission with the org on Pro (rooms unlocked) honors the room as before", async ({ request }) => {
    const org = await createTestClientWithAdmin();
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "pro" } });
    const room = await createTestRoom(org.client.id, { name: "Unlocked Room" });

    try {
      const res = await request.post("/api/submit", { data: payload(org.client, room.id) });
      expect(res.status()).toBe(200);

      const inquiryForRoom = await prisma.inquiry.findFirst({ where: { clientId: org.client.id, roomId: room.id } });
      expect(inquiryForRoom).not.toBeNull();
    } finally {
      await deleteTestOrganization(org.organization.id, org.client.id);
    }
  });
});
