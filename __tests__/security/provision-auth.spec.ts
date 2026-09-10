import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";

// Regression test for Low/Info Punkt 1: /api/provision compared its secret
// with a plain === check instead of a timing-safe comparison, the only
// remaining such spot in the project after the cron-auth fix (which covers
// the three cron routes via lib/cronAuth.ts). Now reuses that same file's
// timingSafeEqualStrings helper. Functional correctness only — a real
// timing side-channel test is disproportionate effort for this risk level.
test.describe("Provisioning endpoint auth", () => {
  let createdOrgId: string | null = null;

  test.afterAll(async () => {
    if (createdOrgId) {
      const org = await prisma.organization.findUnique({ where: { id: createdOrgId }, include: { clients: true, users: true } });
      if (org) {
        for (const c of org.clients) await prisma.client.delete({ where: { id: c.id } });
        for (const u of org.users) await prisma.user.delete({ where: { id: u.id } });
        await prisma.organization.delete({ where: { id: org.id } });
      }
    }
  });

  test("rejects a missing secret", async ({ request }) => {
    const res = await request.post("/api/provision", { data: { name: "Probe", email: "probe1@example.com" } });
    expect(res.status()).toBe(401);
  });

  test("rejects an incorrect secret", async ({ request }) => {
    const res = await request.post("/api/provision", {
      headers: { authorization: "Bearer wrong-secret" },
      data: { name: "Probe", email: "probe2@example.com" },
    });
    expect(res.status()).toBe(401);
  });

  test("accepts the correct secret and provisions an organization", async ({ request }) => {
    const res = await request.post("/api/provision", {
      headers: { authorization: "Bearer test-provisioning-secret" },
      data: { name: "Probe Org", email: `probe-${Date.now()}@example.com` },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.orgId).toBeTruthy();
    createdOrgId = body.orgId;
  });
});
