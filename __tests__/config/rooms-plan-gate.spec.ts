import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, loginAsTestAdmin, deleteTestOrganization } from "../helpers/fixtures";

// Regression test for the client/server plan-gating inconsistency found
// while auditing the Rooms feature (Pro+ only — see lib/plan.ts
// FEATURE_MIN_PLAN): FormularEditor only disables the "Raum-Auswahl" form
// field checkbox client-side (its `locked` flag), but app/api/admin/config
// never re-checked hasFeature() on save. The actual room list is
// independently gated (app/page.tsx and app/api/rooms/route.ts both filter
// via effectivePlan()), so this had no live exploitable effect — but a
// direct API call bypassing the UI could still persist
// formFields.raum:true for a Basis org, and any future formFields-gated
// feature might not be backed by its own independent data-level check.
test.describe("Config save respects the Rooms plan gate", () => {
  test.describe.configure({ mode: "serial" });
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin(); // Basis by default — Rooms needs Pro+
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("a Basis org's direct API call can't persist formFields.raum:true", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const current = await prisma.client.findUniqueOrThrow({ where: { id: org.client.id } });
    const config = JSON.parse(current.config);

    const res = await request.put("/api/admin/config", {
      data: { ...config, formFields: { ...config.formFields, raum: true } },
    });
    // Normalized, not rejected — see the route's own comment for why an
    // outright reject would be its own bug (it would also block saving
    // unrelated fields for an org carrying this leftover state).
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.config.formFields.raum).toBe(false);

    const saved = await prisma.client.findUniqueOrThrow({ where: { id: org.client.id } });
    expect(JSON.parse(saved.config).formFields.raum).toBe(false);
  });

  test("saving an unrelated field still succeeds despite leftover raum:true from before a downgrade", async ({ request }) => {
    // Simulates config data saved while the org was still Pro+ — the (still
    // Basis) UI can never clear this itself, since the checkbox is
    // disabled, not reset, once locked.
    const current = await prisma.client.findUniqueOrThrow({ where: { id: org.client.id } });
    const config = JSON.parse(current.config);
    config.formFields = { ...config.formFields, raum: true };
    await prisma.client.update({ where: { id: org.client.id }, data: { config: JSON.stringify(config) } });

    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.put("/api/admin/config", {
      data: { ...config, company: { ...config.company, name: "Renamed Test Org" } },
    });
    expect(res.ok()).toBe(true);

    const saved = await prisma.client.findUniqueOrThrow({ where: { id: org.client.id } });
    const savedConfig = JSON.parse(saved.config);
    expect(savedConfig.company.name).toBe("Renamed Test Org");
    expect(savedConfig.formFields.raum).toBe(false);
  });

  test("a Pro org can persist formFields.raum:true normally", async ({ request }) => {
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "pro" } });
    await loginAsTestAdmin(request, org.email, org.password);

    const current = await prisma.client.findUniqueOrThrow({ where: { id: org.client.id } });
    const config = JSON.parse(current.config);
    const res = await request.put("/api/admin/config", {
      data: { ...config, formFields: { ...config.formFields, raum: true } },
    });
    expect(res.ok()).toBe(true);

    const saved = await prisma.client.findUniqueOrThrow({ where: { id: org.client.id } });
    expect(JSON.parse(saved.config).formFields.raum).toBe(true);
  });
});
