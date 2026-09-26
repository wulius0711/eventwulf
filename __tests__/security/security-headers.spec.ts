import { test, expect } from "@playwright/test";
import http from "http";
import type { AddressInfo } from "net";
import { createTestClientWithAdmin, deleteTestOrganization } from "../helpers/fixtures";

// Regression test for audit 2026-09-26, M3: /signup, /signup/complete,
// /storniert and the /login redirect carried no security headers at all
// (next.config.ts only covered /, /events, /admin/* and /api/*), so the signup
// page could be framed (clickjacking on the way to Stripe). Every route now
// gets nosniff, a Referrer-Policy, the existing HSTS value (unchanged, as
// already sent on /admin, /api, / and /events), and X-Frame-Options DENY plus a
// CSP with frame-ancestors 'none' — except the two widget pages (/, /events),
// which must stay embeddable, and /api/submit, which keeps its CORS rules.
// The obsolete X-XSS-Protection header is gone everywhere.
test.describe("Security headers", () => {
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;
  let slug: string;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
    slug = org.client.slug;
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  const restrictedPaths = [
    "/signup",
    "/signup/complete?session_id=cs_test_none",
    "/storniert?status=ok",
    "/login", // 307 redirect to /admin/login — the redirect response itself needs the headers too
    "/admin/login",
    "/admin/forgot",
    "/admin/reset/not-a-token",
    "/admin/invite/not-a-token",
    "/api/availability?slug=nobody",
    "/api/rooms?slug=nobody",
    "/manifest.json",
  ];

  function expectCommonHeaders(h: Record<string, string>, label: string) {
    expect(h["x-content-type-options"], `${label}: nosniff`).toBe("nosniff");
    expect(h["referrer-policy"], `${label}: referrer-policy`).toBe("strict-origin-when-cross-origin");
    // Exactly the value the app already sent on the routes that had headers.
    expect(h["strict-transport-security"], `${label}: HSTS`).toBe("max-age=63072000; includeSubDomains; preload");
    expect(h["x-xss-protection"], `${label}: obsolete X-XSS-Protection removed`).toBeUndefined();
  }

  test("every non-widget route is locked against framing and carries the common headers", async ({ request }) => {
    for (const path of restrictedPaths) {
      const res = await request.get(path, { maxRedirects: 0 });
      const h = res.headers();
      expectCommonHeaders(h, path);
      expect(h["x-frame-options"], `${path}: X-Frame-Options`).toBe("DENY");
      expect(h["content-security-policy"], `${path}: CSP`).toContain("frame-ancestors 'none'");
    }
  });

  test("nosniff does not break the scripts customers and browsers load: /embed.js and /sw.js keep a JavaScript content type", async ({ request }) => {
    // /embed.js is included cross-site via <script src>, /sw.js is registered as a
    // service worker — with X-Content-Type-Options: nosniff either is refused
    // unless the server labels it as JavaScript.
    for (const path of ["/embed.js", "/sw.js"]) {
      const res = await request.get(path);
      expect(res.ok(), path).toBe(true);
      const h = res.headers();
      expect(h["content-type"], `${path}: content-type`).toMatch(/(text|application)\/(x-)?javascript/);
      expect(h["x-content-type-options"], `${path}: nosniff`).toBe("nosniff");
    }
  });

  test("the widget pages stay embeddable but carry the common headers", async ({ request }) => {
    for (const path of [`/?kunde=${slug}`, `/events?kunde=${slug}`]) {
      const res = await request.get(path);
      expect(res.ok(), path).toBe(true);
      const h = res.headers();
      expectCommonHeaders(h, path);
      expect(h["x-frame-options"], `${path}: must not forbid framing`).toBeUndefined();
      const csp = h["content-security-policy"] ?? "";
      expect(csp, `${path}: CSP allows embedding`).toContain("frame-ancestors *");
      expect(csp, `${path}: CSP must not lock framing down`).not.toContain("frame-ancestors 'none'");
    }
  });

  test("/api/submit keeps its CORS headers and gets no framing lock-down", async ({ request }) => {
    const res = await request.post("/api/submit", { data: {} }); // 400 from validation — headers are what matters
    expect(res.status()).toBe(400);
    const h = res.headers();
    expectCommonHeaders(h, "/api/submit");
    expect(h["access-control-allow-origin"]).toBe("*");
    expect(h["x-frame-options"]).toBeUndefined();
    expect(h["content-security-policy"]).toBeUndefined();
  });

  test("in a real browser, a foreign origin can embed the widget but not the signup page", async ({ page, baseURL }) => {
    // The embedding "site" is a real HTTP server on 127.0.0.1 (random port), the
    // framed app is localhost:3100 — cross-origin, but both loopback. A document
    // made up with route.fulfill() has no real remote address, so Chromium treats
    // it as public and refuses every navigation to loopback, which would fail
    // every frame and prove nothing about our headers.
    const framed = baseURL!; // http://localhost:3100
    const body = `<!doctype html><html><body>
      <iframe name="widget" src="${framed}/?kunde=${slug}" width="600" height="600"></iframe>
      <iframe name="events" src="${framed}/events?kunde=${slug}" width="600" height="600"></iframe>
      <iframe name="signup" src="${framed}/signup" width="600" height="600"></iframe>
      <iframe name="storniert" src="${framed}/storniert?status=ok" width="600" height="600"></iframe>
    </body></html>`;
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(body);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const embedder = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
      await page.goto(embedder);

      const frame = (name: string) => page.frames().find((f) => f.name() === name)!;
      // Wait until each frame has navigated away from about:blank; a frame refused
      // by X-Frame-Options / frame-ancestors ends up on Chromium's error page.
      for (const name of ["widget", "events", "signup", "storniert"]) {
        await expect.poll(() => frame(name).url(), { timeout: 15_000 }).not.toBe("about:blank");
      }

      expect(frame("widget").url()).toContain(`${framed}/?kunde=${slug}`);
      await expect(frame("widget").locator(".ew-widget-wrap")).toBeVisible();
      expect(frame("events").url()).toContain(`${framed}/events`);
      expect(frame("signup").url(), "signup must be blocked from framing").toBe("chrome-error://chromewebdata/");
      expect(frame("storniert").url(), "storniert must be blocked from framing").toBe("chrome-error://chromewebdata/");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test("the stricter policy does not break the pages that now get it (no CSP violations, page renders)", async ({ page }) => {
    for (const path of ["/signup", "/storniert?status=ok", "/admin/login", "/admin/forgot"]) {
      const violations: string[] = [];
      page.on("console", (msg) => {
        if (/content security policy|refused to (load|apply|execute|connect|frame)/i.test(msg.text())) violations.push(msg.text());
      });
      page.on("pageerror", (err) => violations.push(`pageerror: ${err.message}`));

      const res = await page.goto(path);
      expect(res?.ok(), path).toBe(true);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("body")).not.toBeEmpty();
      expect(violations, `${path}: CSP violations or page errors`).toEqual([]);
      page.removeAllListeners("console");
      page.removeAllListeners("pageerror");
    }
  });
});
