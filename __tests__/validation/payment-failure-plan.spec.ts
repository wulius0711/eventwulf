import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, createTestRoom, loginAsTestAdmin, deleteTestOrganization } from "../helpers/fixtures";

// Regression test for the Durchgang-1 High finding: a failed recurring
// payment only ever changes `subscriptionStatus` (Stripe's own webhook
// behavior — see app/api/stripe/webhook/route.ts), never `org.plan` itself.
// Feature/limit enforcement used to read `org.plan` directly, so a customer
// kept full paid access for the entire multi-week Stripe dunning cycle
// (past_due -> ... -> unpaid/canceled) before `customer.subscription.deleted`
// finally reset the plan. Fix: every enforcement point now reads
// effectivePlan(org) instead, which treats past_due/unpaid as an effective
// (but not persisted) downgrade to Basis. See lib/plan.ts.
test.describe("Plan enforcement during a payment failure (past_due)", () => {
  // Serial: later cases depend on the subscriptionStatus flip from earlier
  // ones, same reasoning as the other plan-downgrade suites in this project.
  test.describe.configure({ mode: "serial" });
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;
  let roomId: string;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "premium", subscriptionStatus: "active" } });
    const room = await createTestRoom(org.client.id, { name: "Premium Room" });
    roomId = room.id;
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("while active: rooms feature is unlocked and unlimited, per the org's real premium plan", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.get("/api/admin/rooms");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.plan).toBe("premium");
    expect(body.limit).toBeNull();
  });

  test("payment fails (past_due): rooms feature locks even though org.plan is still premium in the DB", async ({ request }) => {
    await prisma.organization.update({ where: { id: org.organization.id }, data: { subscriptionStatus: "past_due" } });

    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.get("/api/admin/rooms");
    expect(res.status()).toBe(403); // Rooms needs Pro+; effectivePlan() is now "basis"

    // The subscribed plan itself is deliberately untouched — a later
    // successful payment must restore premium without us remembering it.
    const dbOrg = await prisma.organization.findUniqueOrThrow({ where: { id: org.organization.id } });
    expect(dbOrg.plan).toBe("premium");
  });

  test("payment still failing: public widget also hides the room, though the row still exists", async ({ request }) => {
    const res = await request.get(`/api/rooms?slug=${org.client.slug}`);
    expect(res.ok()).toBe(true);
    const rooms = await res.json();
    expect(rooms).toHaveLength(0);

    const stillExists = await prisma.room.findUnique({ where: { id: roomId } });
    expect(stillExists).not.toBeNull();
  });

  test("payment still failing: team invite limit drops to Basis's 1 and a new invite is rejected, though premium allows unlimited", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);

    const getRes = await request.get("/api/admin/team");
    expect(getRes.ok()).toBe(true);
    const getBody = await getRes.json();
    expect(getBody.plan).toBe("basis");
    expect(getBody.limit).toBe(1);
    expect(getBody.members).toHaveLength(1); // the admin created by the fixture — already at the Basis limit

    const postRes = await request.post("/api/admin/team", { data: { email: `${org.client.slug}-invitee@example.com` } });
    expect(postRes.status()).toBe(400);
    const postBody = await postRes.json();
    expect(postBody.error).toContain("Basis");
  });

  test("payment resumes (active again): access is restored instantly, live from the DB — no cached/stale plan", async ({ request }) => {
    await prisma.organization.update({ where: { id: org.organization.id }, data: { subscriptionStatus: "active" } });

    await loginAsTestAdmin(request, org.email, org.password);
    const roomsRes = await request.get("/api/admin/rooms");
    expect(roomsRes.ok()).toBe(true);
    const roomsBody = await roomsRes.json();
    expect(roomsBody.plan).toBe("premium");
    expect(roomsBody.limit).toBeNull();

    const teamRes = await request.get("/api/admin/team");
    const teamBody = await teamRes.json();
    expect(teamBody.plan).toBe("premium");
    expect(teamBody.limit).toBeNull();
  });
});
