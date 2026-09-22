import { randomBytes } from "crypto";
import { hashSync } from "bcryptjs";
import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, loginAsTestAdmin, deleteTestOrganization } from "../helpers/fixtures";

test.describe("Team invite races", () => {
  // Regression test for the Durchgang-3 Medium finding: findValidInvite()
  // (a read) and the password-set update used to be two separate steps, so
  // two near-simultaneous POSTs with the same still-valid token could both
  // pass the read before either write landed, and both walk away with a
  // valid session for the same account. Fixed by conditioning the update's
  // WHERE clause on inviteToken itself (not just id) and checking the
  // affected-row count — same atomic-conditional-update principle as
  // reserveEventCapacity (lib/eventCapacity.ts), applied to an invite token
  // instead of a capacity counter.
  test.describe("Invite token consumption", () => {
    let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;
    let token: string;

    test.beforeAll(async () => {
      org = await createTestClientWithAdmin();
      token = randomBytes(32).toString("hex");
      await prisma.user.create({
        data: {
          email: `invitee-${org.client.slug}@example.com`,
          password: hashSync(randomBytes(32).toString("hex"), 12),
          organizationId: org.organization.id,
          inviteToken: token,
          inviteTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });

    test.afterAll(async () => {
      await deleteTestOrganization(org.organization.id, org.client.id);
    });

    test("only one of five concurrent accepts for the same token succeeds", async ({ request }) => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          request.post("/api/admin/team/accept", { data: { token, password: `RaceToken-${i}-${randomBytes(4).toString("hex")}Aa1!` } })
        )
      );
      const statuses = responses.map((r) => r.status());
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      expect(statuses.filter((s) => s === 400)).toHaveLength(4);

      // Exactly one response actually issued a session cookie.
      const issuedCookie = responses.filter((r) => (r.headers()["set-cookie"] ?? "").length > 0);
      expect(issuedCookie).toHaveLength(1);

      const dbUser = await prisma.user.findFirst({ where: { organizationId: org.organization.id, email: { contains: "invitee-" } } });
      expect(dbUser?.inviteToken).toBeNull();
    });
  });

  // Regression test for the Durchgang-3 Info finding: the pre-check
  // (findUnique by email) and the create() were two separate steps, so two
  // concurrent invites for the same brand-new email could both pass the
  // pre-check and race on the create — the loser hit the unique-constraint
  // violation unhandled, surfacing as a 500. Phase 4 later made the "email
  // already exists" response generic across the board (see
  // GENERIC_INVITE_OK in app/api/admin/team/route.ts) to close the
  // cross-tenant enumeration channel (Durchgang 3, Fund 4), so the losing
  // request here now gets the same 200 as any other "already exists" case
  // instead of a distinct 400 — still never a 500, which is the thing this
  // test actually guards.
  test.describe("Duplicate email invite", () => {
    let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

    test.beforeAll(async () => {
      org = await createTestClientWithAdmin();
      // Premium's team limit is unlimited — isolates this test from the
      // separate team-limit race covered in plan-limit-race.spec.ts.
      await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "premium" } });
    });

    test.afterAll(async () => {
      await deleteTestOrganization(org.organization.id, org.client.id);
    });

    test("a losing concurrent invite for the same brand-new email never surfaces as a 500", async ({ request }) => {
      await loginAsTestAdmin(request, org.email, org.password);
      const email = `race-dup-${org.client.slug}@example.com`;

      const responses = await Promise.all(Array.from({ length: 5 }, () => request.post("/api/admin/team", { data: { email } })));
      const statuses = responses.map((r) => r.status());
      // All 5 get the same generic 200 (Phase 4) — only one of them actually
      // created the User row, verified below via the DB, not via status code.
      expect(statuses.every((s) => s === 200)).toBe(true);

      const count = await prisma.user.count({ where: { email } });
      expect(count).toBe(1);
    });
  });
});
