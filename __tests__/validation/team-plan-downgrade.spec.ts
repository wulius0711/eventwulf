import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, loginAsTestAdmin, deleteTestOrganization } from "../helpers/fixtures";

// Basis is capped at 1 team member, Pro at 2 (lib/plan.ts teamLimitFor) —
// unlike rooms, any logged-in member of the org can invite/remove others
// (same permissions for everyone, per user decision), not just a superadmin.
test.describe("Team plan downgrade — existing members survive, invites are gated by count", () => {
  test.describe.configure({ mode: "serial" });
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;
  let secondMemberId: string;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "pro" } });
    const secondMember = await prisma.user.create({
      data: { email: `${org.client.slug}-2@example.com`, password: "unused", organizationId: org.organization.id },
    });
    secondMemberId = secondMember.id;
    // Downgrade after the 2nd member was added — pro (limit 2) allowed it,
    // basis's limit of 1 is now retroactively exceeded.
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "basis" } });
  });

  test.afterAll(async () => {
    await prisma.user.deleteMany({ where: { organizationId: org.organization.id } });
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("existing members survive the downgrade and are both listed", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.get("/api/admin/team");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.members).toHaveLength(2);
    expect(body.limit).toBe(1);
  });

  test("inviting a 3rd member while over the limit is rejected", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.post("/api/admin/team", { data: { email: `${org.client.slug}-3@example.com` } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Maximal 1 Team-Mitglied(er)");
  });

  test("a member cannot remove themselves", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.delete("/api/admin/team", { data: { userId: org.user.id } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("nicht selbst entfernen");
  });

  test("removing the other member brings the org exactly to the limit — a new invite still isn't allowed", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const removeRes = await request.delete("/api/admin/team", { data: { userId: secondMemberId } });
    expect(removeRes.ok()).toBe(true);

    // Basis's limit is 1 — the owner alone already fills it, so removing the
    // 2nd member (2 -> 1) lands exactly at the limit, not under it. Unlike
    // rooms/events (limit 3), there's no "under the limit with room to
    // spare" state to reach here short of upgrading the plan.
    const inviteRes = await request.post("/api/admin/team", { data: { email: `${org.client.slug}-4@example.com` } });
    expect(inviteRes.status()).toBe(400);
  });

  test("upgrading the plan allows inviting again", async ({ request }) => {
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "pro" } });
    await loginAsTestAdmin(request, org.email, org.password);
    const inviteRes = await request.post("/api/admin/team", { data: { email: `${org.client.slug}-4@example.com` } });
    expect(inviteRes.ok()).toBe(true);
  });
});
