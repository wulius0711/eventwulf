import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClient, createTestRoom, deleteTestClient, isoDateInDays } from "../helpers/fixtures";

// Regression test for Fund 6: room capacity vs. participant count was only
// checked client-side (a non-blocking hint in the request form). Any direct
// call to /api/submit could exceed a room's stated capacity, since the
// server never read room.capacity at all. Fixed as a plain read alongside
// the existing room.isActive check — no transaction needed, since capacity
// doesn't change between requests in a way that creates a race.
test.describe("Room capacity enforcement in /api/submit", () => {
  let client: Awaited<ReturnType<typeof createTestClient>>;

  test.beforeAll(async () => {
    client = await createTestClient();
  });

  test.afterAll(async () => {
    await deleteTestClient(client.id);
  });

  function payload(roomId: string, personenAnzahl: string) {
    return {
      slug: client.slug,
      roomId,
      artTitel: "Capacity Validation Test",
      nameGruppenleitung: "Tester",
      email: "guest@example.com",
      datumVon: isoDateInDays(30),
      datumBis: isoDateInDays(30),
      personenAnzahl,
    };
  }

  test("rejects a request exceeding the room's capacity", async ({ request }) => {
    const room = await createTestRoom(client.id, { capacity: 10 });

    const res = await request.post("/api/submit", { data: payload(room.id, "11") });
    expect(res.status()).toBe(400);

    const saved = await prisma.inquiry.findMany({ where: { roomId: room.id } });
    expect(saved).toHaveLength(0);
  });

  test("accepts a request within the room's capacity", async ({ request }) => {
    const room = await createTestRoom(client.id, { capacity: 10 });

    const res = await request.post("/api/submit", { data: payload(room.id, "10") });
    expect(res.status()).toBe(200);

    const saved = await prisma.inquiry.findMany({ where: { roomId: room.id } });
    expect(saved).toHaveLength(1);
  });

  test("capacity: null means unlimited — a very high count still succeeds", async ({ request }) => {
    const room = await prisma.room.create({
      data: { clientId: client.id, name: "Unlimited Room", capacity: null, isActive: true },
    });

    const res = await request.post("/api/submit", { data: payload(room.id, "5000") });
    expect(res.status()).toBe(200);
  });
});
