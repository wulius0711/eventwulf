import { test, expect } from "@playwright/test";
import { sanitizeEmailHeader } from "../../lib/validate";

// Regression test for the "from" header gap found while working Low/Info
// Punkt 3 (Durchgang, unescaped email HTML): subject and replyTo in
// /api/submit already stripped CR/LF/tab to prevent header injection (a
// crafted value adding e.g. its own Bcc: line), but the exact same
// company.name value used in the "from" field, in the same file, was never
// run through that protection — no apparent reason beyond the original fix
// not being rolled out consistently. Same gap existed in reminders.ts's
// from/subject, which had no header-injection protection at all.
// company.name is admin-editable config, not purely theoretical.
// Distinct vulnerability class from the HTML-escaping fix in the same
// files — tracked and committed separately on purpose.
test.describe("Email header injection guard (sanitizeEmailHeader)", () => {
  test("strips CR, LF, and tab so no extra header line can be injected", () => {
    const malicious = "Retreat GmbH\r\nBcc: attacker@evil.example";
    const result = sanitizeEmailHeader(malicious);
    expect(result).not.toContain("\r");
    expect(result).not.toContain("\n");
    expect(result).toBe("Retreat GmbH  Bcc: attacker@evil.example"); // \r and \n each become their own space
  });

  test("strips tabs and trims surrounding whitespace", () => {
    expect(sanitizeEmailHeader("  Name\twith\ttabs  ")).toBe("Name with tabs");
  });

  test("ordinary values pass through unchanged", () => {
    expect(sanitizeEmailHeader("Berghof GmbH")).toBe("Berghof GmbH");
  });

  test("nullish values become an empty string, not \"null\"/\"undefined\"", () => {
    expect(sanitizeEmailHeader(null)).toBe("");
    expect(sanitizeEmailHeader(undefined)).toBe("");
  });
});
