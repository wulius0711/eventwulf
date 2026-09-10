import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, loginAsTestAdmin, deleteTestOrganization, randomSlug } from "../helpers/fixtures";

// Regression test for the CSS/HTML injection gaps found while fixing Fund 8:
// company.primaryColor and formBgColor were never format-validated on save,
// and lib/invoiceTemplate.ts interpolated company.name, recipient name, event
// title, notes, and line-item descriptions raw into a served text/html
// response with no escaping at all.
test.describe("Config injection points", () => {
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("rejects a non-hex primaryColor on config save", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const current = await prisma.client.findUniqueOrThrow({ where: { id: org.client.id } });
    const config = JSON.parse(current.config);

    const res = await request.put("/api/admin/config", {
      data: { ...config, company: { ...config.company, primaryColor: "red; } body { display: none; } /*" } },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects an unsafe formBgColor on config save", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const current = await prisma.client.findUniqueOrThrow({ where: { id: org.client.id } });
    const config = JSON.parse(current.config);

    const res = await request.put("/api/admin/config", {
      data: { ...config, formBgColor: "red; } body { display: none; } /*" },
    });
    expect(res.status()).toBe(400);
  });

  test("defense in depth: a pre-existing unsafe formBgColor never reaches the rendered <style> tag", async ({ request }) => {
    // Written directly via Prisma to simulate data saved before this fix
    // existed — validateConfig can't protect data it never saw.
    const current = await prisma.client.findUniqueOrThrow({ where: { id: org.client.id } });
    const config = JSON.parse(current.config);
    config.formBgColor = "red; } body { display: none; } /*";
    await prisma.client.update({ where: { id: org.client.id }, data: { config: JSON.stringify(config) } });

    const res = await request.get(`/?kunde=${org.client.slug}`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    // The raw value still appears JSON-encoded in the RSC data payload (a
    // <script> tag passing `config` as a prop to the client-side Wizard
    // component) — that's React's normal, safely-escaped data channel, not
    // an unsafe sink, so it isn't what this test is about. What matters is
    // the one place the value used to be interpolated raw into literal CSS:
    // the <style> tag itself must show the safe fallback, not the payload.
    expect(body).toContain("<style>body { background: transparent; }</style>");
  });
});

test.describe("Invoice HTML escaping", () => {
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("escapes company.name, recipient name, and line item description in the served invoice page", async ({ request }) => {
    // company.name written directly to simulate a value saved before
    // escaping existed — proves the fix isn't only a save-time gate.
    const current = await prisma.client.findUniqueOrThrow({ where: { id: org.client.id } });
    const config = JSON.parse(current.config);
    config.company.name = '<script>alert("name")</script>';
    await prisma.client.update({ where: { id: org.client.id }, data: { config: JSON.stringify(config) } });

    // nameGruppenleitung/artTitel are guest-submitted and only length-checked
    // by validateSubmit, not HTML-checked — a realistic path for this value.
    const inquiry = await prisma.inquiry.create({
      data: {
        clientId: org.client.id,
        data: JSON.stringify({
          artTitel: "Retreat",
          nameGruppenleitung: '<img src=x onerror=alert("recipient")>',
          email: "guest@example.com",
          datumVon: "2026-12-01",
          datumBis: "2026-12-01",
        }),
        status: "neu",
        cancelToken: randomSlug("token"),
      },
    });

    await loginAsTestAdmin(request, org.email, org.password);
    const createRes = await request.post("/api/admin/invoices", {
      data: {
        inquiryId: inquiry.id,
        updatedAt: inquiry.updatedAt.toISOString(),
        lineItems: [{ description: '"><script>alert("desc")</script>', quantity: 1, unitPrice: 10 }],
        sendEmail: false,
      },
    });
    expect(createRes.status()).toBe(200);
    const invoice = await createRes.json();

    const htmlRes = await request.get(`/api/admin/invoices/${invoice.id}/html`);
    expect(htmlRes.status()).toBe(200);
    const html = await htmlRes.text();

    // Check the raw, executable form is absent — not just a substring that
    // could still appear (safely) inside already-escaped text.
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x onerror=");
    expect(html).not.toContain('"><script>');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(&quot;recipient&quot;)&gt;");
  });
});
