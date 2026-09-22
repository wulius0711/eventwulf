import { test, expect } from "@playwright/test";
import { getIp } from "@/lib/ratelimit";

// Regression test for the Durchgang-1 Fund 6 hardening: getIp() used to take
// the FIRST entry of a comma-separated X-Forwarded-For chain (the earliest,
// least-trusted hop) and never looked at x-vercel-forwarded-for at all.
// Empirically verified against a real Vercel deployment (temporary
// diagnostic route, since removed) that Vercel's edge already overwrites all
// three headers with the genuine client IP and discards client-supplied
// values — so this isn't an active spoofing vector on the current
// deployment, but the hardening (prefer x-vercel-forwarded-for, take the
// LAST entry of any chain) is kept for defense-in-depth against a future
// proxy-in-front-of-Vercel setup, per Vercel's own documented guidance.
// Pure function, no DB/network — a plain Request with fabricated headers is
// enough.
test.describe("getIp — deriving the client IP from Vercel's forwarding headers", () => {
  function reqWithHeaders(headers: Record<string, string>): Request {
    return new Request("http://localhost/", { headers });
  }

  test("prefers x-vercel-forwarded-for over x-forwarded-for", () => {
    const req = reqWithHeaders({ "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "2.2.2.2" });
    expect(getIp(req)).toBe("1.1.1.1");
  });

  test("falls back to x-forwarded-for when x-vercel-forwarded-for is absent", () => {
    const req = reqWithHeaders({ "x-forwarded-for": "2.2.2.2" });
    expect(getIp(req)).toBe("2.2.2.2");
  });

  test("falls back to x-real-ip when neither forwarded header is present", () => {
    const req = reqWithHeaders({ "x-real-ip": "3.3.3.3" });
    expect(getIp(req)).toBe("3.3.3.3");
  });

  test("takes the LAST entry of a comma-separated chain, not the first", () => {
    const req = reqWithHeaders({ "x-forwarded-for": "client-claimed, 9.9.9.9, 203.0.113.42" });
    expect(getIp(req)).toBe("203.0.113.42");
  });

  test("returns 'unknown' when no IP header is present at all", () => {
    const req = reqWithHeaders({});
    expect(getIp(req)).toBe("unknown");
  });
});
