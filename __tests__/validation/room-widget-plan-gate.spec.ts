import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, createTestRoom, deleteTestOrganization } from "../helpers/fixtures";

// Regression test: Rooms is a Pro+ feature (lib/plan.ts FEATURE_MIN_PLAN),
// but a downgrade to Basis never touched existing Room rows — only new
// creation/reactivation was blocked (see room-plan-downgrade.spec.ts). That
// left existing rooms fully visible and bookable in the public guest widget
// even on a plan that doesn't include Rooms at all. app/page.tsx and
// app/api/rooms/route.ts now filter the guest-facing room list by
// hasFeature(plan, "rooms") — this test guards that gate.
test.describe("Public room list respects the Rooms plan gate", () => {
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "pro" } });
    await createTestRoom(org.client.id, { name: "Seminarraum" });
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("rooms are returned while on Pro", async ({ request }) => {
    const res = await request.get(`/api/rooms?slug=${org.client.slug}`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  test("rooms are hidden from the public API after downgrading to Basis, though the row still exists", async ({ request }) => {
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "basis" } });

    const res = await request.get(`/api/rooms?slug=${org.client.slug}`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveLength(0);

    const stillInDb = await prisma.room.findMany({ where: { clientId: org.client.id } });
    expect(stillInDb).toHaveLength(1);
    expect(stillInDb[0].isActive).toBe(true);
  });

  test("re-upgrading to Pro instantly restores the room in the public API", async ({ request }) => {
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "pro" } });

    const res = await request.get(`/api/rooms?slug=${org.client.slug}`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });
});
