import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

// Regression test for the open-redirect finding in proxy.ts (the
// eventwulf.at -> Framer reverse proxy, Next.js 16's convention-based edge
// middleware): the Location header on Framer's response used to be
// forwarded to the client with only a substring check ("does it contain
// eventwulf.framer.website?") gating a naive .replace() — anything else
// passed through completely unvalidated, and even the substring check was
// itself exploitable (a target like
// "https://eventwulf.framer.website.evil.com/..." also contains that
// substring). Fixed by resolving `location` into a real URL and comparing
// actual hostnames instead of substrings: only the Framer host (rewritten
// to the real domain) or an already-correct same-origin target are
// forwarded; anything else is dropped entirely (fail-safe).
//
// This can't be exercised over real HTTP against the Playwright test
// server: proxy() only activates for the `eventwulf.at`/`www.eventwulf.at`
// Host header (see the early return in proxy.ts), which the test server
// (localhost:3100) never sends. proxy() is called directly instead, with
// global.fetch mocked to stand in for the upstream Framer response — no
// network call happens either way.
test.describe("Framer proxy — Location-header open-redirect allowlist", () => {
  function withFakeUpstreamRedirect(location: string | null, fn: () => Promise<void>) {
    return async () => {
      const originalFetch = global.fetch;
      global.fetch = (async () => {
        const headers = new Headers();
        if (location !== null) headers.set("location", location);
        return new Response(null, { status: 302, headers });
      }) as typeof fetch;
      try {
        await fn();
      } finally {
        global.fetch = originalFetch;
      }
    };
  }

  function proxyRequest(path = "/some-path") {
    return new NextRequest(`https://eventwulf.at${path}`, { headers: { host: "eventwulf.at" } });
  }

  test(
    "a redirect to the Framer host is rewritten to the real domain",
    withFakeUpstreamRedirect("https://eventwulf.framer.website/some-path", async () => {
      const res = await proxy(proxyRequest());
      expect(res?.headers.get("location")).toBe("https://eventwulf.at/some-path");
    })
  );

  test(
    "a relative redirect from Framer resolves through the Framer host and is rewritten the same way",
    withFakeUpstreamRedirect("/already-relative", async () => {
      const res = await proxy(proxyRequest());
      expect(res?.headers.get("location")).toBe("https://eventwulf.at/already-relative");
    })
  );

  test(
    "a redirect to a completely unrelated third-party domain is dropped, never forwarded",
    withFakeUpstreamRedirect("https://evil.com/phishing", async () => {
      const res = await proxy(proxyRequest());
      expect(res?.headers.has("location")).toBe(false);
    })
  );

  test(
    "a redirect target that merely contains the Framer host as a substring (not the actual host) is dropped, not naively string-replaced",
    withFakeUpstreamRedirect("https://eventwulf.framer.website.evil.com/x", async () => {
      const res = await proxy(proxyRequest());
      expect(res?.headers.has("location")).toBe(false);
    })
  );

  test(
    "no Location header at all is left alone (not every upstream response is a redirect)",
    withFakeUpstreamRedirect(null, async () => {
      const res = await proxy(proxyRequest());
      expect(res?.headers.has("location")).toBe(false);
    })
  );
});
