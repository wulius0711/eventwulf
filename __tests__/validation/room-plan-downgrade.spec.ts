import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, createTestRoom, loginAsTestAdmin, deleteTestOrganization } from "../helpers/fixtures";

// Regression test for Medium finding 6 (Durchgang 3, part 2): a plan
// downgrade leaving a client with more rooms than their new plan allows.
// Verification found the create-time limit check already existed
// (app/api/admin/rooms/route.ts) — existing rooms were never touched by a
// downgrade (no deactivation logic exists anywhere), so "existing rooms
// survive, only new creation is blocked" (the recommended option) was
// already the de facto behavior. Two things were actually missing/wrong:
// the count didn't filter by isActive, so a client couldn't recover by
// deactivating excess rooms (defeating the whole point of not blocking the
// downgrade itself); and PATCH had no limit check at all, so reactivating a
// deactivated room bypassed the creation gate entirely. Both fixed here,
// plus a UI notice — no new create-time enforcement needed, it already
// existed.
test.describe("Room plan downgrade — existing rooms survive, creation is gated by active count", () => {
  // The four cases build on each other's room state on purpose (deactivate,
  // then create, then reactivate) — serial like the other order-dependent
  // suites in this project (fullyParallel: true would otherwise let them
  // run out of order).
  test.describe.configure({ mode: "serial" });
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;
  const roomIds: string[] = [];

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "premium" } });
    for (let i = 0; i < 5; i++) {
      const room = await createTestRoom(org.client.id, { name: `Room ${i}` });
      roomIds.push(room.id);
    }
    // Downgrade after creation — premium (unlimited) allowed all 5, pro's
    // limit of 3 is now retroactively exceeded.
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "pro" } });
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("existing rooms stay active and retrievable after the downgrade", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.get("/api/admin/rooms");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.rooms).toHaveLength(5);
    expect(body.rooms.every((r: { isActive: boolean }) => r.isActive)).toBe(true);
    expect(body.limit).toBe(3);
  });

  test("creating a new room while over the limit is rejected", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.post("/api/admin/rooms", { data: { name: "One too many" } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Maximal 3 Räume");
  });

  test("deactivating excess rooms down to the limit allows creation again", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);

    // Deactivate 3 of the 5 (5 active -> 2 active), well under the limit of 3.
    for (const id of roomIds.slice(0, 3)) {
      const res = await request.patch("/api/admin/rooms", { data: { id, isActive: false } });
      expect(res.ok()).toBe(true);
    }

    const created = await request.post("/api/admin/rooms", { data: { name: "Back under the limit" } });
    expect(created.ok()).toBe(true);
  });

  test("reactivating a deactivated room while at the limit is rejected, same as creating one", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    // From the previous test: 2 originals still active + 1 newly created = 3 active, at the limit.
    const deactivatedId = roomIds[0];
    const res = await request.patch("/api/admin/rooms", { data: { id: deactivatedId, isActive: true } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Maximal 3 Räume");

    const reloaded = await prisma.room.findUniqueOrThrow({ where: { id: deactivatedId } });
    expect(reloaded.isActive).toBe(false); // unchanged, not silently reactivated
  });
});
