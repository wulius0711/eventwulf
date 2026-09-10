import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { randomSlug, deleteTestClient } from "../helpers/fixtures";

// Regression test for Fund 8: the documented three-layer config fallback
// (DB -> file -> default) only worked for 5 hardcoded fields in practice —
// loadConfigFromDB shallow-merged against a separate ARRAY_DEFAULTS object,
// not default.json, so any DB config with a partially-filled nested object
// (e.g. company: {primaryColor: "..."}) replaced that whole object with no
// fallback for its other fields. An incomplete config save could crash the
// public widget (buildThemeVars throwing on an undefined primaryColor).
// Fixed with a real per-field deep merge between default.json and the DB
// config. These tests go through the actual page routes (not loadConfigFromDB
// directly), since that function reads DATABASE_URL from process.env, which
// in the Playwright test-runner process itself points at production — only
// the spawned webServer process (which these HTTP requests hit) is wired to
// the test DB.
test.describe("Config fallback in the public widget", () => {
  async function createClientWithRawConfig(config: object) {
    const slug = randomSlug("config-fallback");
    const client = await prisma.client.create({
      data: { slug, config: JSON.stringify(config) },
    });
    return client;
  }

  test("DB config with only primaryColor set — other fields fall back, no crash", async ({ request }) => {
    const client = await createClientWithRawConfig({ company: { primaryColor: "#123456" } });

    const res = await request.get(`/?kunde=${client.slug}`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("#123456"); // DB value used
    expect(body).not.toContain("Internal Server Error");

    await deleteTestClient(client.id);
  });

  test("DB config completely empty — default.json fills every field", async ({ request }) => {
    const client = await createClientWithRawConfig({});

    const res = await request.get(`/?kunde=${client.slug}`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("#4f46e5"); // default.json's primaryColor

    await deleteTestClient(client.id);
  });

  test("no client row for the slug at all — falls back to default.json, no crash", async ({ request }) => {
    const res = await request.get(`/?kunde=${randomSlug("nonexistent")}`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("#4f46e5");
  });

  test("/events route: same fallback behavior", async ({ request }) => {
    const client = await createClientWithRawConfig({ company: { primaryColor: "#abcdef" } });

    const res = await request.get(`/events?kunde=${client.slug}`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("#abcdef");

    await deleteTestClient(client.id);
  });
});
