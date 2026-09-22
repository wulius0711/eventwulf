import { test, expect } from "@playwright/test";
import { inviteEmailHtml, welcomeEmailHtml } from "@/lib/emailTemplates";

// Regression test for the Durchgang-3 Medium finding: org.name/session.email
// (invite email) and meta.companyName (welcome/onboarding email) were
// interpolated raw into the HTML body. sanitizeEmailHeader() (used
// elsewhere for the `from` header) only strips \r\n\t — it never escaped
// HTML, so it never protected these two sinks. Both templates now run their
// inputs through escapeHtml() (lib/validate.ts), the same function already
// used consistently in lib/invoiceTemplate.ts.
//
// Pure functions, no DB/network/Resend call needed — exactly why they were
// pulled out of the route files in the first place.
test.describe("Email template HTML-escaping", () => {
  const XSS_PAYLOAD = '<img src=x onerror=alert(document.cookie)>';
  const ESCAPED_PAYLOAD = "&lt;img src=x onerror=alert(document.cookie)&gt;";

  test("inviteEmailHtml escapes a malicious org name", () => {
    const html = inviteEmailHtml("admin@example.com", XSS_PAYLOAD, "https://example.com/invite/token");
    expect(html).not.toContain(XSS_PAYLOAD);
    expect(html).toContain(ESCAPED_PAYLOAD);
  });

  test("inviteEmailHtml escapes a malicious inviter email", () => {
    const html = inviteEmailHtml(XSS_PAYLOAD, "Acme GmbH", "https://example.com/invite/token");
    expect(html).not.toContain(XSS_PAYLOAD);
    expect(html).toContain(ESCAPED_PAYLOAD);
  });

  test("inviteEmailHtml still renders normal values and the invite link unescaped-but-safe", () => {
    const html = inviteEmailHtml("admin@example.com", "Acme GmbH", "https://example.com/invite/token123");
    expect(html).toContain("admin@example.com");
    expect(html).toContain("Acme GmbH");
    expect(html).toContain('href="https://example.com/invite/token123"');
  });

  test("welcomeEmailHtml escapes a malicious company name", () => {
    const html = welcomeEmailHtml(XSS_PAYLOAD, "https://example.com/invite/token");
    expect(html).not.toContain(XSS_PAYLOAD);
    expect(html).toContain(ESCAPED_PAYLOAD);
  });

  test("welcomeEmailHtml still renders a normal company name", () => {
    const html = welcomeEmailHtml("Acme GmbH", "https://example.com/invite/token");
    expect(html).toContain("Willkommen bei eventwulf, Acme GmbH!");
  });
});
