import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, createTestRoom, loginAsTestAdmin, deleteTestOrganization } from "../helpers/fixtures";

// Regression test for Medium finding 4 (Durchgang 1, part 4): deleting a
// Room silently unassigned it from any Event referencing it (Event.room has
// onDelete: SetNull) — the Event survived, but its calendar-blocking
// behavior changed with no trace: an Event with a Room only blocks that
// Room's own calendar, but once roomId is nulled an "intern" Event blocks
// the whole general calendar again (see components/Calendar.tsx). The admin
// deleting the Room had no way to know this happened. DELETE /api/admin/rooms
// did not look at assigned Events at all before deleting — it now requires
// an explicit `confirmed: true` once there is at least one active Event
// still referencing the room, returning 409 + the real count instead.
test.describe("Room deletion warns about assigned events", () => {
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
    // Rooms are gated behind the "pro" plan (see lib/plan.ts) — the default
    // test org is "basis", which would 403 before ever reaching the delete
    // logic under test here.
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "pro" } });
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("blocks deletion with a 409 + count when an active event is assigned, until confirmed", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);

    const room = await createTestRoom(org.client.id, { name: "Room with an event" });
    const event = await prisma.event.create({
      data: {
        clientId: org.client.id,
        name: "Assigned event",
        startDate: new Date(Date.now() + 10 * 86400000),
        endDate: new Date(Date.now() + 11 * 86400000),
        isActive: true,
        roomId: room.id,
      },
    });

    const blocked = await request.delete("/api/admin/rooms", { data: { id: room.id } });
    expect(blocked.status()).toBe(409);
    const blockedBody = await blocked.json();
    expect(blockedBody.requiresConfirmation).toBe(true);
    expect(blockedBody.eventCount).toBe(1);

    // Not deleted yet — no silent action taken.
    const stillThere = await prisma.room.findUnique({ where: { id: room.id } });
    expect(stillThere).not.toBeNull();
    const eventUnchanged = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(eventUnchanged.roomId).toBe(room.id);

    const confirmedRes = await request.delete("/api/admin/rooms", { data: { id: room.id, confirmed: true } });
    expect(confirmedRes.ok()).toBe(true);

    const deletedRoom = await prisma.room.findUnique({ where: { id: room.id } });
    expect(deletedRoom).toBeNull();

    // The Event survives, unassigned from the now-gone room.
    const eventAfter = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(eventAfter.roomId).toBeNull();
  });

  test("deletes without confirmation when no active event is assigned", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);

    const room = await createTestRoom(org.client.id, { name: "Room without events" });

    const res = await request.delete("/api/admin/rooms", { data: { id: room.id } });
    expect(res.ok()).toBe(true);

    const deleted = await prisma.room.findUnique({ where: { id: room.id } });
    expect(deleted).toBeNull();
  });

  test("an inactive event assigned to the room does not require confirmation", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);

    const room = await createTestRoom(org.client.id, { name: "Room with only an inactive event" });
    await prisma.event.create({
      data: {
        clientId: org.client.id,
        name: "Inactive event",
        startDate: new Date(Date.now() + 10 * 86400000),
        endDate: new Date(Date.now() + 11 * 86400000),
        isActive: false,
        roomId: room.id,
      },
    });

    const res = await request.delete("/api/admin/rooms", { data: { id: room.id } });
    expect(res.ok()).toBe(true);
  });
});
