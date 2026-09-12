import { randomBytes } from "crypto";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClient, createTestRoom, createTestEvent, deleteTestClient, isoDateInDays } from "../helpers/fixtures";

// Regression test for Fund 3: Event.bookedCount was incremented in a separate
// query from the Inquiry insert, so a crash/timeout between the two could
// leak capacity with no corresponding inquiry. Both now run in one
// transaction (see reserveEventCapacity in lib/eventCapacity.ts and its call
// inside the $transaction in app/api/submit/route.ts).
test.describe("Event capacity reservation atomicity in /api/submit", () => {
  let client: Awaited<ReturnType<typeof createTestClient>>;

  test.beforeAll(async () => {
    client = await createTestClient();
  });

  test.afterAll(async () => {
    await deleteTestClient(client.id);
  });

  function payload(eventId: string, participantCount: number, overrides: Record<string, unknown> = {}) {
    return {
      slug: client.slug,
      eventId,
      artTitel: "Capacity Test",
      nameGruppenleitung: "Tester",
      email: "guest@example.com",
      datumVon: isoDateInDays(20),
      datumBis: isoDateInDays(20),
      personenAnzahl: String(participantCount),
      ...overrides,
    };
  }

  async function fireConcurrentSubmits(request: APIRequestContext, eventId: string, count: number, participantCount: number) {
    const body = payload(eventId, participantCount);
    return Promise.all(Array.from({ length: count }, () => request.post("/api/submit", { data: body })));
  }

  test("does not let two concurrent bookings jointly exceed capacity", async ({ request }) => {
    const event = await createTestEvent(client.id, { minParticipants: 1, maxParticipants: 6 });

    const responses = await fireConcurrentSubmits(request, event.id, 2, 6);
    const statuses = responses.map((r) => r.status()).sort((a, b) => a - b);

    expect(statuses).toEqual([200, 400]);

    const saved = await prisma.inquiry.findMany({ where: { eventId: event.id } });
    expect(saved).toHaveLength(1);

    const reloaded = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(reloaded.bookedCount).toBe(6);
  });

  test("admits exactly as many of five concurrent bookings as capacity allows", async ({ request }) => {
    // maxParticipants 15, 6 seats each: exactly 2 fit (12 <= 15), a 3rd would need 18.
    const event = await createTestEvent(client.id, { minParticipants: 1, maxParticipants: 15 });

    const responses = await fireConcurrentSubmits(request, event.id, 5, 6);
    const statuses = responses.map((r) => r.status());

    expect(statuses.filter((s) => s === 200)).toHaveLength(2);
    expect(statuses.filter((s) => s === 400)).toHaveLength(3);

    const saved = await prisma.inquiry.findMany({ where: { eventId: event.id } });
    expect(saved).toHaveLength(2);

    const reloaded = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(reloaded.bookedCount).toBe(12);
  });

  test("rolls back the capacity reservation when a later step in the same transaction fails", async ({ request }) => {
    // Unlimited event capacity, so the reservation itself never blocks — the
    // failure comes purely from a room conflict that happens *after* the
    // capacity UPDATE has already run inside the transaction. Only a
    // "bestaetigt" inquiry blocks a room (see lib/roomAvailability.ts), so we
    // seed one directly rather than via a first live submission. If the
    // capacity reservation and the room check weren't atomic, the failed
    // request's capacity increment would survive even though its inquiry was
    // never saved.
    const event = await createTestEvent(client.id, { minParticipants: 1, maxParticipants: null });
    const room = await createTestRoom(client.id);
    const datumVon = isoDateInDays(25);
    const datumBis = isoDateInDays(25);

    await prisma.inquiry.create({
      data: {
        clientId: client.id,
        data: JSON.stringify({ datumVon, datumBis }),
        status: "bestaetigt",
        participantCount: 1,
        cancelToken: randomBytes(24).toString("hex"),
        roomId: room.id,
      },
    });

    const second = await request.post("/api/submit", {
      data: payload(event.id, 5, { roomId: room.id, datumVon, datumBis }),
    });
    expect(second.status()).toBe(409);

    const reloaded = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(reloaded.bookedCount).toBe(0);

    const saved = await prisma.inquiry.findMany({ where: { eventId: event.id } });
    expect(saved).toHaveLength(0);
  });
});
