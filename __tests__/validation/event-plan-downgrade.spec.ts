import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, createTestEvent, loginAsTestAdmin, deleteTestOrganization } from "../helpers/fixtures";

// Basis is capped at 3 active events (lib/plan.ts eventLimitFor) — unlike
// rooms, events are available on every plan, only the count is gated.
// Mirrors the same create/reactivate enforcement pattern already covered
// for rooms in room-plan-downgrade.spec.ts.
test.describe("Event plan downgrade — existing events survive, creation is gated by active count", () => {
  test.describe.configure({ mode: "serial" });
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;
  const eventIds: string[] = [];

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "pro" } });
    for (let i = 0; i < 5; i++) {
      const event = await createTestEvent(org.client.id, { name: `Event ${i}` });
      eventIds.push(event.id);
    }
    // Downgrade after creation — pro (unlimited) allowed all 5, basis's
    // limit of 3 is now retroactively exceeded.
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "basis" } });
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("existing events stay active and retrievable after the downgrade", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.get("/api/admin/events");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.events).toHaveLength(5);
    expect(body.events.every((e: { isActive: boolean }) => e.isActive)).toBe(true);
    expect(body.limit).toBe(3);
  });

  test("creating a new event while over the limit is rejected", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.post("/api/admin/events", {
      data: { name: "One too many", startDate: new Date(Date.now() + 32 * 86400000).toISOString(), endDate: new Date(Date.now() + 33 * 86400000).toISOString() },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Maximal 3 aktive Events");
  });

  test("deactivating excess events down to the limit allows creation again", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);

    // Deactivate 3 of the 5 (5 active -> 2 active), well under the limit of 3.
    for (const id of eventIds.slice(0, 3)) {
      const res = await request.patch("/api/admin/events", { data: { id, isActive: false } });
      expect(res.ok()).toBe(true);
    }

    const created = await request.post("/api/admin/events", {
      data: { name: "Back under the limit", startDate: new Date(Date.now() + 32 * 86400000).toISOString(), endDate: new Date(Date.now() + 33 * 86400000).toISOString() },
    });
    expect(created.ok()).toBe(true);
  });

  test("reactivating a deactivated event while at the limit is rejected, same as creating one", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    // From the previous test: 2 originals still active + 1 newly created = 3 active, at the limit.
    const deactivatedId = eventIds[0];
    const res = await request.patch("/api/admin/events", { data: { id: deactivatedId, isActive: true } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Maximal 3 aktive Events");

    const reloaded = await prisma.event.findUniqueOrThrow({ where: { id: deactivatedId } });
    expect(reloaded.isActive).toBe(false); // unchanged, not silently reactivated
  });
});
