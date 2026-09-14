import { test, expect } from "@playwright/test";
import { resolveBaseUrl } from "../../app/api/submit/route";

// Regression test for a finding surfaced while working Low/Info Punkt 3
// (unescaped email HTML), tracked and committed separately since it's a
// different vulnerability class: /api/submit built the iCal/cancel links'
// href from the request's Host header, which Vercel's own docs describe as
// reflecting whatever the client sent
// (https://vercel.com/docs/headers/request-headers#host) — not validated
// against the deployment's real domain. VERCEL_URL is set automatically by
// Vercel for every deployment and isn't client-controllable, so it's used
// whenever available; the request header remains a fallback for local dev,
// where there's no untrusted client to spoof it against. VERCEL_URL is only
// ever set when actually running on Vercel, so this can't be exercised
// end-to-end against the local test server — resolveBaseUrl is exported
// specifically to make the choice of source directly testable.
//
// NEXT_PUBLIC_APP_URL was added on top afterwards: VERCEL_URL is documented
// to always be the deployment's own *.vercel.app alias, never a custom
// domain attached to the project, so once app.eventwulf.at went live as the
// real production domain, VERCEL_URL alone kept putting vercel.app into
// every emailed link. NEXT_PUBLIC_APP_URL is a server-controlled env var
// (same trust level as VERCEL_URL), so giving it top priority doesn't
// reopen the Host-header spoofing gap.
test.describe("Base URL source for guest-facing email links", () => {
  test("prefers NEXT_PUBLIC_APP_URL over VERCEL_URL and a spoofed Host header when set", () => {
    const result = resolveBaseUrl("https://app.eventwulf.at", "eventwulf.vercel.app", "evil.example");
    expect(result.host).toBe("app.eventwulf.at");
    expect(result.proto).toBe("https");
  });

  test("prefers VERCEL_URL over a spoofed Host header when NEXT_PUBLIC_APP_URL is unset", () => {
    const result = resolveBaseUrl(undefined, "eventwulf.vercel.app", "evil.example");
    expect(result.host).toBe("eventwulf.vercel.app");
    expect(result.proto).toBe("https");
  });

  test("falls back to the request Host header when neither env var is set (local dev)", () => {
    const result = resolveBaseUrl(undefined, undefined, "localhost:3100");
    expect(result.host).toBe("localhost:3100");
    expect(result.proto).toBe("http");
  });

  test("falls back to https for a non-localhost header when neither env var is set", () => {
    const result = resolveBaseUrl(undefined, undefined, "example.com");
    expect(result.proto).toBe("https");
  });
});
