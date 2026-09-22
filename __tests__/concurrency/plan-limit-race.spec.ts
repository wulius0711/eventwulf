import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import {
  createTestClientWithAdmin, createTestRoom, createTestEvent, loginAsTestAdmin, deleteTestOrganization,
  randomSlug, isoDateInDays, createSuperadminProbeUser, deleteSuperadminProbeUser,
} from "../helpers/fixtures";

// Regression tests for the Durchgang-2 Medium finding: all four plan-limit
// checks (rooms, events, team, locations) were a separate count() followed
// by a separate create()/update(), with no lock or DB constraint tying the
// two together — two concurrent requests that both read the count just
// under the limit could both pass and jointly exceed it. Fixed with the
// same pg_advisory_xact_lock pattern already used for room availability
// (see lib/roomAvailability.ts) — each limit check + create now runs inside
// a transaction that first takes a lock scoped to the same key the count
// query is scoped to, so a second concurrent transaction blocks until the
// first commits and its new row is already visible when it re-counts.

test.describe("Plan-limit TOCTOU races", () => {
  test.describe("Rooms", () => {
    let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

    test.beforeAll(async () => {
      org = await createTestClientWithAdmin();
      // Pro's room limit is 3 — two existing active rooms leave exactly one slot.
      await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "pro" } });
      await createTestRoom(org.client.id, { name: "Room A" });
      await createTestRoom(org.client.id, { name: "Room B" });
    });

    test.afterAll(async () => {
      await deleteTestOrganization(org.organization.id, org.client.id);
    });

    test("admits exactly one of five concurrent creates for the last slot", async ({ request }) => {
      await loginAsTestAdmin(request, org.email, org.password);

      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, i) => request.post("/api/admin/rooms", { data: { name: `Race Room ${i}` } }))
      );
      const statuses = responses.map((r) => r.status());
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      expect(statuses.filter((s) => s === 400)).toHaveLength(4);

      const count = await prisma.room.count({ where: { clientId: org.client.id, isActive: true } });
      expect(count).toBe(3);
    });
  });

  test.describe("Events", () => {
    let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

    test.beforeAll(async () => {
      org = await createTestClientWithAdmin();
      // Basis's event limit is 3 — two existing active events leave exactly one slot.
      await createTestEvent(org.client.id, { name: "Event A" });
      await createTestEvent(org.client.id, { name: "Event B" });
    });

    test.afterAll(async () => {
      await deleteTestOrganization(org.organization.id, org.client.id);
    });

    test("admits exactly one of five concurrent creates for the last slot", async ({ request }) => {
      await loginAsTestAdmin(request, org.email, org.password);

      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          request.post("/api/admin/events", {
            data: { name: `Race Event ${i}`, startDate: isoDateInDays(40), endDate: isoDateInDays(41) },
          })
        )
      );
      const statuses = responses.map((r) => r.status());
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      expect(statuses.filter((s) => s === 400)).toHaveLength(4);

      const count = await prisma.event.count({ where: { clientId: org.client.id, isActive: true } });
      expect(count).toBe(3);
    });
  });

  test.describe("Team", () => {
    let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

    test.beforeAll(async () => {
      org = await createTestClientWithAdmin();
      // Pro's team limit is 2 — the fixture's own admin already counts as 1
      // member, leaving exactly one slot.
      await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "pro" } });
    });

    test.afterAll(async () => {
      await deleteTestOrganization(org.organization.id, org.client.id);
    });

    test("admits exactly one of five concurrent invites for the last slot", async ({ request }) => {
      await loginAsTestAdmin(request, org.email, org.password);

      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          request.post("/api/admin/team", { data: { email: `race-invitee-${i}-${org.client.slug}@example.com` } })
        )
      );
      const statuses = responses.map((r) => r.status());
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      expect(statuses.filter((s) => s === 400)).toHaveLength(4);

      const count = await prisma.user.count({ where: { organizationId: org.organization.id } });
      expect(count).toBe(2);
    });
  });

  test.describe("Standorte (locations)", () => {
    // This endpoint gates purely on session.clientSlug === SUPERADMIN_SLUG
    // (app/api/admin/orgs/[id]/clients/route.ts) — there's no separate
    // superadmin flag/role. The organization behind that slug is real,
    // pre-existing seed data (the local/shared superadmin account), NOT
    // something a test may create, claim, or delete — see
    // createSuperadminProbeUser in helpers/fixtures.ts, which adds one
    // disposable User row to that *existing* organization instead of
    // creating/claiming its Client.
    let probe: Awaited<ReturnType<typeof createSuperadminProbeUser>>;
    let targetOrgId: string;

    test.beforeAll(async () => {
      probe = await createSuperadminProbeUser();
      const targetOrg = await prisma.organization.create({ data: { name: "race-target-org", plan: "pro" } }); // Pro's location limit is 1, org starts with 0 Standorte
      targetOrgId = targetOrg.id;
    });

    test.afterAll(async () => {
      await prisma.client.deleteMany({ where: { organizationId: targetOrgId } });
      await prisma.organization.delete({ where: { id: targetOrgId } });
      await deleteSuperadminProbeUser(probe.userId);
    });

    test("admits exactly one of five concurrent creates for a fresh org's only slot", async ({ request }) => {
      await loginAsTestAdmin(request, probe.email, probe.password);

      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          request.post(`/api/admin/orgs/${targetOrgId}/clients`, { data: { slug: randomSlug(`race-loc-${i}`) } })
        )
      );
      const statuses = responses.map((r) => r.status());
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      expect(statuses.filter((s) => s === 400)).toHaveLength(4);

      const count = await prisma.client.count({ where: { organizationId: targetOrgId } });
      expect(count).toBe(1);
    });
  });
});
