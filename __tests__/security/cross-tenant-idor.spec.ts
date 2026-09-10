import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClient, createTestRoom, createTestEvent, deleteTestClient, isoDateInDays } from "../helpers/fixtures";

// Regression test for the Cross-Tenant IDOR fixed in /api/submit: resolving
// roomId/eventId via findUnique (no clientId scope) let a request to Client
// A's public form book a room/event that actually belonged to Client B, as
// long as the id was guessed or enumerated. Fix: both lookups are now
// findFirst({ id, clientId: client.id }), scoped to the client resolved from
// the request's own slug. This test only covers that one scenario — not a
// systematic audit of every id-based endpoint.
test.describe("Cross-tenant IDOR in /api/submit", () => {
  let clientA: Awaited<ReturnType<typeof createTestClient>>;
  let clientB: Awaited<ReturnType<typeof createTestClient>>;
  let roomA: Awaited<ReturnType<typeof createTestRoom>>;
  let roomB: Awaited<ReturnType<typeof createTestRoom>>;
  let eventA: Awaited<ReturnType<typeof createTestEvent>>;
  let eventB: Awaited<ReturnType<typeof createTestEvent>>;

  test.beforeAll(async () => {
    clientA = await createTestClient();
    clientB = await createTestClient();
    roomA = await createTestRoom(clientA.id);
    roomB = await createTestRoom(clientB.id);
    eventA = await createTestEvent(clientA.id);
    eventB = await createTestEvent(clientB.id);
  });

  test.afterAll(async () => {
    await deleteTestClient(clientA.id);
    await deleteTestClient(clientB.id);
  });

  function payload(overrides: Record<string, unknown>) {
    return {
      artTitel: "IDOR Regressionstest",
      nameGruppenleitung: "Tester",
      email: "guest@example.com",
      datumVon: isoDateInDays(5),
      datumBis: isoDateInDays(5),
      personenAnzahl: "5",
      ...overrides,
    };
  }

  test("rejects Client A's slug with Client B's roomId", async ({ request }) => {
    const res = await request.post("/api/submit", {
      data: payload({ slug: clientA.slug, roomId: roomB.id }),
    });
    expect(res.status()).toBe(400);

    const leaked = await prisma.inquiry.findFirst({ where: { clientId: clientA.id, roomId: roomB.id } });
    expect(leaked).toBeNull();
  });

  test("rejects Client A's slug with Client B's eventId", async ({ request }) => {
    const res = await request.post("/api/submit", {
      data: payload({ slug: clientA.slug, eventId: eventB.id }),
    });
    expect(res.status()).toBe(400);

    const leaked = await prisma.inquiry.findFirst({ where: { clientId: clientA.id, eventId: eventB.id } });
    expect(leaked).toBeNull();
  });

  test("accepts Client A's slug with Client A's own roomId (positive control)", async ({ request }) => {
    const res = await request.post("/api/submit", {
      data: payload({ slug: clientA.slug, roomId: roomA.id, datumVon: isoDateInDays(6), datumBis: isoDateInDays(6) }),
    });
    expect(res.status()).toBe(200);

    const saved = await prisma.inquiry.findFirst({ where: { clientId: clientA.id, roomId: roomA.id } });
    expect(saved).not.toBeNull();
  });

  test("accepts Client A's slug with Client A's own eventId (positive control)", async ({ request }) => {
    const res = await request.post("/api/submit", {
      data: payload({ slug: clientA.slug, eventId: eventA.id, datumVon: isoDateInDays(7), datumBis: isoDateInDays(7) }),
    });
    expect(res.status()).toBe(200);

    const saved = await prisma.inquiry.findFirst({ where: { clientId: clientA.id, eventId: eventA.id } });
    expect(saved).not.toBeNull();
  });
});
