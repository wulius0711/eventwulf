import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, deleteTestOrganization } from "../helpers/fixtures";

// Regression test for audit 2026-09-26, M2: app/page.tsx handed the tenant's
// whole config to the client-side Wizard, so notifyEmail (the operator's
// internal inbox), company contact data and billing settings were embedded in
// the public widget HTML. Only the fields the wizard actually reads may reach
// the browser: formFields, the *Options lists and customFields.
const SECRET = {
  notifyEmail: "geheim-notify-xyz@example.com",
  companyEmail: "leak-company-xyz@example.com",
  phone: "+43 999 LEAK-PHONE-XYZ",
  address: "Leakstrasse 99 LEAK-ADDRESS-XYZ",
  tagline: "LEAK-TAGLINE-XYZ",
  website: "https://leak-website-xyz.example",
  taxRate: 0.1337,
  validityDays: 4242,
};

function configJson() {
  return JSON.stringify({
    company: {
      name: "Widget Config Test",
      tagline: SECRET.tagline,
      email: SECRET.companyEmail,
      phone: SECRET.phone,
      address: SECRET.address,
      website: SECRET.website,
      primaryColor: "#336699",
    },
    notifyEmail: SECRET.notifyEmail,
    billing: { taxRate: SECRET.taxRate, validityDays: SECRET.validityDays },
    ausstattungOptions: ["Beamer-XYZ"],
    verpflegungOptions: ["Fruehstueck-XYZ"],
    customFields: [
      { id: "cf_text", step: 2, label: "Pflichtfrage-XYZ", type: "text", required: true },
      { id: "cf_diet", step: 4, label: "Ernaehrung-XYZ", type: "checkboxGroup", required: true, options: ["Vegan-XYZ", "Vegetarisch-XYZ"] },
    ],
  });
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

test.describe("Public widget receives only the config fields it uses", () => {
  test.describe.configure({ mode: "serial" });
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
    await prisma.client.update({ where: { id: org.client.id }, data: { config: configJson() } });
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("the widget page HTML carries no internal or contact config", async ({ request }) => {
    const res = await request.get(`/?kunde=${org.client.slug}`);
    expect(res.ok()).toBe(true);
    const html = await res.text();

    expect(html).not.toContain("notifyEmail");
    expect(html).not.toContain(SECRET.notifyEmail);
    expect(html).not.toContain(SECRET.companyEmail);
    expect(html).not.toContain("LEAK-PHONE-XYZ");
    expect(html).not.toContain("LEAK-ADDRESS-XYZ");
    expect(html).not.toContain(SECRET.tagline);
    expect(html).not.toContain("leak-website-xyz");
    expect(html).not.toContain(String(SECRET.taxRate));
    expect(html).not.toContain(String(SECRET.validityDays));
    expect(html).not.toContain("billing");

    // Positive control: what the wizard needs is still shipped to the browser.
    expect(html).toContain("Fruehstueck-XYZ");
    expect(html).toContain("Ernaehrung-XYZ");
  });

  test("the events page HTML carries no internal or contact config", async ({ request }) => {
    const res = await request.get(`/events?kunde=${org.client.slug}`);
    expect(res.ok()).toBe(true);
    const html = await res.text();
    expect(html).not.toContain("notifyEmail");
    expect(html).not.toContain(SECRET.notifyEmail);
    expect(html).not.toContain(SECRET.companyEmail);
    expect(html).not.toContain("LEAK-PHONE-XYZ");
  });

  test("a guest can still go through all five steps and submit", async ({ page }) => {
    await page.goto(`/?kunde=${org.client.slug}`);

    // Step 1: title + a date range next month (the 10th to the 12th)
    await page.locator(".ew-field", { hasText: "Art / Titel" }).locator("input").fill("Durchlauf Workshop");
    await page.getByRole("button", { name: "Nächster Monat" }).click();
    await page.locator(".ew-cal-day").filter({ hasText: /^10$/ }).click();
    await page.locator(".ew-cal-day").filter({ hasText: /^12$/ }).click();
    await page.getByRole("button", { name: /Weiter/ }).click();

    // Step 2: contact data, participant count, the required custom text question
    await page.locator(".ew-field", { hasText: "Name Gruppenleitung" }).locator("input").fill("Anna Durchlauf");
    await page.locator(".ew-field", { hasText: /^E-Mail/ }).locator("input").fill("anna.durchlauf@example.com");
    await page.locator(".ew-field", { hasText: "Anzahl Teilnehmer" }).locator("input").fill("8");
    await page.locator(".ew-field", { hasText: "Pflichtfrage-XYZ" }).locator("input").fill("Antwort A");
    await page.getByRole("button", { name: /Weiter/ }).click();

    // Step 3: an equipment option from config.ausstattungOptions
    await page.getByText("Beamer-XYZ").click();
    await page.getByRole("button", { name: /Weiter/ }).click();

    // Step 4: a select from config.verpflegungOptions + the required checkbox group
    await page.locator(".ew-field", { hasText: "Verpflegung" }).locator("select").selectOption("Fruehstueck-XYZ");
    await page.getByText("Vegan-XYZ").click();
    await page.getByRole("button", { name: /Weiter/ }).click();

    // Step 5: submit
    await page.getByRole("button", { name: "Anfragen" }).click();
    await expect(page.getByText("Anfrage gesendet!")).toBeVisible();

    const inquiries = await prisma.inquiry.findMany({ where: { clientId: org.client.id } });
    expect(inquiries).toHaveLength(1);
    const data = JSON.parse(inquiries[0].data);
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 10);
    expect(data.artTitel).toBe("Durchlauf Workshop");
    expect(data.nameGruppenleitung).toBe("Anna Durchlauf");
    expect(data.email).toBe("anna.durchlauf@example.com");
    expect(data.personenAnzahl).toBe("8");
    expect(data.datumVon).toBe(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-10`);
    expect(data.datumBis).toBe(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-12`);
    expect(data.verpflegung).toBe("Fruehstueck-XYZ");
    expect(data.ausstattungExtra).toContain("Beamer-XYZ");
    expect(data.customFields.cf_text).toBe("Antwort A");
    expect(data.customFields.cf_diet).toEqual(["Vegan-XYZ"]);
  });
});
