import { test, expect } from "@playwright/test";
import { row } from "../../app/api/submit/route";

// Regression test for Low/Info Punkt 3, expanded scope: verifying other
// email templates in the project (per the finding's own instruction) found
// the same unescaped-interpolation pattern already fixed in
// reminders.ts/invoiceTemplate.ts also present in /api/submit's row()
// helper — used for every field in both the operator notification and
// guest confirmation emails, arguably more central than reminders.ts since
// it fires on every single submission, not just next-day confirmed
// bookings. Tests the actual rendered markup directly (row is exported for
// exactly this reason), not just that submitting doesn't error.
test.describe("Submit email HTML escaping (row helper)", () => {
  test("escapes a guest-submitted script tag", () => {
    const html = row("Art / Titel", "<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("escapes a double-quote attribute-breakout attempt", () => {
    const html = row("Gruppenleitung", `"><img src=x onerror=alert(1)>`);
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&quot;&gt;&lt;img");
  });

  test("ordinary values still render correctly", () => {
    const html = row("Gruppenleitung", "Anna Müller");
    expect(html).toContain("Gruppenleitung");
    expect(html).toContain("Anna Müller");
  });

  test("empty or placeholder values still produce no row, unchanged", () => {
    expect(row("Equipment", "")).toBe("");
    expect(row("Equipment", "–")).toBe("");
  });
});
