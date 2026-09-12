import { test, expect, type APIRequestContext } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClient, createTestRoom, deleteTestClient, isoDateInDays } from "../helpers/fixtures";

// Regression test for the pg_advisory_xact_lock serialization in
// assertRoomAvailable (lib/roomAvailability.ts). Only a "bestaetigt" inquiry
// blocks a room (see BLOCKING_STATUSES) — a fresh submission is always
// "neu", so truly concurrent submissions for the same room/timeframe no
// longer conflict with each other and must all succeed. The lock still
// matters for correctness: it serializes the concurrent transactions so
// every one of them lands as its own row with no lost or corrupted writes.
// Does NOT cover Fund 3 (Event capacity can leak because
// reserveEventCapacity runs outside the save transaction) — that's a
// separate bug in Block B with its own test once its fix lands.
test.describe("Advisory-lock race condition on /api/submit (room booking)", () => {
  let client: Awaited<ReturnType<typeof createTestClient>>;

  test.beforeAll(async () => {
    client = await createTestClient();
  });

  test.afterAll(async () => {
    await deleteTestClient(client.id);
  });

  test("sanity: rate limiter is bypassed in this environment", async ({ request }) => {
    // Guards the race tests below from failing on 429 instead of the actual
    // logic under test if the RATELIMIT_DISABLED wiring ever regresses.
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        request.post("/api/submit", {
          data: {
            slug: "rate-limit-sanity-probe",
            artTitel: "x",
            nameGruppenleitung: "x",
            datumVon: isoDateInDays(1),
            datumBis: isoDateInDays(1),
            personenAnzahl: "1",
          },
        })
      )
    );
    expect(results.some((r) => r.status() === 429)).toBe(false);
  });

  function payload(roomId: string) {
    return {
      slug: client.slug,
      roomId,
      artTitel: "Race Test",
      nameGruppenleitung: "Tester",
      email: "guest@example.com",
      datumVon: isoDateInDays(20),
      datumBis: isoDateInDays(20),
      personenAnzahl: "5",
    };
  }

  async function fireConcurrentSubmits(request: APIRequestContext, roomId: string, count: number) {
    const body = payload(roomId);
    return Promise.all(Array.from({ length: count }, () => request.post("/api/submit", { data: body })));
  }

  test("two truly concurrent requests for the same room/timeframe both succeed", async ({ request }) => {
    const room = await createTestRoom(client.id, { name: "Race Room 2x" });

    const responses = await fireConcurrentSubmits(request, room.id, 2);
    const statuses = responses.map((r) => r.status());

    expect(statuses.every((s) => s === 200)).toBe(true);

    const saved = await prisma.inquiry.findMany({ where: { roomId: room.id } });
    expect(saved).toHaveLength(2);
  });

  test("five truly concurrent requests for the same room/timeframe all succeed", async ({ request }) => {
    const room = await createTestRoom(client.id, { name: "Race Room 5x" });

    const responses = await fireConcurrentSubmits(request, room.id, 5);
    const statuses = responses.map((r) => r.status());

    expect(statuses.every((s) => s === 200)).toBe(true);

    const saved = await prisma.inquiry.findMany({ where: { roomId: room.id } });
    expect(saved).toHaveLength(5);
  });
});
