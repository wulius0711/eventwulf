import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, loginAsTestAdmin, deleteTestOrganization } from "../helpers/fixtures";

// Regression test for Durchgang 3, Fund 4: inviting a team member checked
// User.email uniqueness GLOBALLY (across all orgs, not just the inviting
// one) and answered with a distinct 400 "Diese E-Mail ist bereits
// registriert" — any org admin could use this to find out whether a given
// address was registered to a completely unrelated organization. Fixed by
// answering identically (status, body shape, and roughly timing) whether
// the invite actually happened or the email already belonged to someone
// else — same technique as GENERIC_OK in app/api/admin/forgot/route.ts.
// Platform-wide email uniqueness itself stays as-is (a schema change would
// make the currently org-less login flow ambiguous for no real benefit) —
// this fixes the enumeration symptom directly at the response, not the
// underlying uniqueness rule.
test.describe("Team invite doesn't leak whether an email exists on another org", () => {
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;
  let otherOrg: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "premium" } }); // unlimited team — isolates this from the separate team-limit race
    otherOrg = await createTestClientWithAdmin(); // a completely unrelated org — its admin's email is the "already exists elsewhere" probe
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
    await deleteTestOrganization(otherOrg.organization.id, otherOrg.client.id);
  });

  test("inviting a known-elsewhere email and a brand-new email answer identically", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const newEmail = `enum-new-${org.client.slug}@example.com`;

    const existingRes = await request.post("/api/admin/team", { data: { email: otherOrg.email } });
    const newRes = await request.post("/api/admin/team", { data: { email: newEmail } });

    expect(existingRes.status()).toBe(newRes.status());
    expect(await existingRes.json()).toEqual(await newRes.json());

    // The known-elsewhere email must not actually have been added to THIS org.
    const asMember = await prisma.user.findFirst({ where: { email: otherOrg.email, organizationId: org.organization.id } });
    expect(asMember).toBeNull();
    // The brand-new email really was invited.
    const invited = await prisma.user.findFirst({ where: { email: newEmail, organizationId: org.organization.id } });
    expect(invited).not.toBeNull();
  });

  test("response timing for an already-registered email is roughly the same as a real invite", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);

    const t0 = Date.now();
    await request.post("/api/admin/team", { data: { email: otherOrg.email } });
    const existingMs = Date.now() - t0;

    const t1 = Date.now();
    await request.post("/api/admin/team", { data: { email: `enum-timing-${org.client.slug}@example.com` } });
    const newMs = Date.now() - t1;

    // Not an exact match (Resend/network variance on the real invite path)
    // — this only guards against the old gap, an instant 400 vs. a real
    // hash+DB-write+email-send, which would fail this by an order of
    // magnitude, not by a few hundred ms.
    expect(Math.abs(existingMs - newMs)).toBeLessThan(1000);
  });
});
