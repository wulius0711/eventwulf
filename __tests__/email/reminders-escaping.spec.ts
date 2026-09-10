import { test, expect } from "@playwright/test";
import { renderReminderHtml } from "../../app/api/cron/reminders/route";

// Regression test for Low/Info Punkt 3: reminders.ts had the same
// unescaped-interpolation pattern as the invoiceTemplate.ts finding from
// Fund 8 — guest-submitted values flowed raw into the reminder email HTML.
// Tests the actual rendered output, not just "no error" — reminder emails
// never come back as an HTTP response body the way the served invoice page
// does, so renderReminderHtml is exported specifically to make this
// possible without a network-level Resend interception.
test.describe("Reminder email HTML escaping", () => {
  test("escapes a guest-submitted script tag in every text field", () => {
    const payload = "<script>alert(1)</script>";
    const html = renderReminderHtml(
      {
        nameGruppenleitung: payload,
        artTitel: payload,
        datumVon: "2026-09-20",
        datumBis: "2026-09-21",
        zeitVon: payload,
        zeitBis: payload,
        personenAnzahl: "5",
      },
      { company: { name: payload, address: payload, phone: payload } }
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</script>");
    // Escaped form must actually be present, not just the tag stripped —
    // confirms it's real escaping, not accidental removal.
    expect(html).toContain("&lt;script&gt;");
  });

  test("escapes a double-quote attribute-breakout attempt", () => {
    const payload = `"><img src=x onerror=alert(1)>`;
    const html = renderReminderHtml(
      {
        nameGruppenleitung: payload,
        artTitel: "Retreat",
        datumVon: "2026-09-20",
        datumBis: "2026-09-21",
        zeitVon: "",
        zeitBis: "",
        personenAnzahl: "5",
      },
      { company: { name: "Test GmbH" } }
    );

    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&quot;&gt;&lt;img");
  });

  test("ordinary values still render correctly", () => {
    const html = renderReminderHtml(
      {
        nameGruppenleitung: "Anna Müller",
        artTitel: "Firmenretreat",
        datumVon: "2026-09-20",
        datumBis: "2026-09-21",
        zeitVon: "14:00",
        zeitBis: "18:00",
        personenAnzahl: "12",
      },
      { company: { name: "Berghof GmbH", address: "Musterstraße 1", phone: "+43 1 234567" } }
    );

    expect(html).toContain("Anna Müller");
    expect(html).toContain("Firmenretreat");
    expect(html).toContain("20.09.2026");
    expect(html).toContain("14:00 Uhr");
    expect(html).toContain("Berghof GmbH");
    expect(html).toContain("Musterstraße 1");
  });
});
