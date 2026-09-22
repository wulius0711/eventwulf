import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { randomSlug, createSuperadminProbeUser, deleteSuperadminProbeUser, loginAsTestAdmin } from "../helpers/fixtures";

// Phase 3 (Standorte soft-disable): mirrors room-plan-downgrade.spec.ts /
// event-plan-downgrade.spec.ts, ported 1:1 to Standorte (Client rows) as
// asked — there is no automatic "which one gets deactivated" selection
// logic anywhere in the codebase for any of the three resource types, so
// the same rule applies here: existing Standorte are never touched by a
// downgrade, only new creation/reactivation past the (active-only) count is
// blocked. A superadmin deactivates whichever Standort they choose
// manually, bringing the org back under its new limit without destroying
// its data — the reversible alternative to DELETE.
test.describe("Standorte (locations) plan downgrade — existing Standorte survive, creation is gated by active count", () => {
  // Order-dependent on purpose (deactivate, then create, then reactivate),
  // like the analogous Rooms/Events suites.
  test.describe.configure({ mode: "serial" });
  let probe: Awaited<ReturnType<typeof createSuperadminProbeUser>>;
  let orgId: string;
  const originalSlugs: string[] = [];

  test.beforeAll(async () => {
    probe = await createSuperadminProbeUser();
    const org = await prisma.organization.create({ data: { name: "standorte-downgrade-org", plan: "premium" } });
    orgId = org.id;
    for (let i = 0; i < 5; i++) {
      const slug = randomSlug(`downgrade-loc-${i}`);
      await prisma.client.create({
        data: { slug, config: JSON.stringify({ company: { name: "x" }, notifyEmail: "notify@example.com" }), organizationId: orgId },
      });
      originalSlugs.push(slug);
    }
    // Downgrade after creation — premium (unlimited) allowed all 5, pro's
    // limit of 1 is now retroactively exceeded.
    await prisma.organization.update({ where: { id: orgId }, data: { plan: "pro" } });
  });

  test.afterAll(async () => {
    await prisma.client.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.delete({ where: { id: orgId } });
    await deleteSuperadminProbeUser(probe.userId);
  });

  test("existing Standorte stay active and retrievable after the downgrade", async ({ request }) => {
    await loginAsTestAdmin(request, probe.email, probe.password);
    const res = await request.get("/api/admin/clients");
    expect(res.ok()).toBe(true);
    const orgs = await res.json();
    const org = orgs.find((o: { id: string }) => o.id === orgId);
    expect(org.clients).toHaveLength(5);
    expect(org.clients.every((c: { isActive: boolean }) => c.isActive)).toBe(true);
    expect(org.locationLimit).toBe(1);
  });

  test("creating a new Standort while over the limit is rejected", async ({ request }) => {
    await loginAsTestAdmin(request, probe.email, probe.password);
    const res = await request.post(`/api/admin/orgs/${orgId}/clients`, { data: { slug: randomSlug("one-too-many") } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Maximal 1 Standort");
  });

  test("deactivating excess Standorte down to the limit allows creation again", async ({ request }) => {
    await loginAsTestAdmin(request, probe.email, probe.password);

    // Deactivate all 5 originals (5 active -> 0 active), well under the limit of 1.
    for (const slug of originalSlugs) {
      const res = await request.patch(`/api/admin/orgs/${orgId}/clients`, { data: { slug, isActive: false } });
      expect(res.ok()).toBe(true);
    }

    const created = await request.post(`/api/admin/orgs/${orgId}/clients`, { data: { slug: randomSlug("back-under-the-limit") } });
    expect(created.ok()).toBe(true);
  });

  test("reactivating a deactivated Standort while at the limit is rejected, same as creating one", async ({ request }) => {
    await loginAsTestAdmin(request, probe.email, probe.password);
    // From the previous test: 0 originals active + 1 newly created = 1 active, at the limit.
    const deactivatedSlug = originalSlugs[0];
    const res = await request.patch(`/api/admin/orgs/${orgId}/clients`, { data: { slug: deactivatedSlug, isActive: true } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Maximal 1 Standort");

    const reloaded = await prisma.client.findUniqueOrThrow({ where: { slug: deactivatedSlug } });
    expect(reloaded.isActive).toBe(false); // unchanged, not silently reactivated
  });

  test("the superadmin's own Standort can't be deactivated", async ({ request }) => {
    await loginAsTestAdmin(request, probe.email, probe.password);
    const superadminSlug = process.env.SUPERADMIN_SLUG ?? "admin";
    const res = await request.patch(`/api/admin/orgs/${probe.organizationId}/clients`, { data: { slug: superadminSlug, isActive: false } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Superadmin-Slug");
  });
});
