import { test, expect } from "@playwright/test";

// Regression test for audit 2026-09-26, H1 (part 1): lib/bunny.ts must not
// send any DELETE to Bunny until path-safe deletion lands (Phase 5). Runs the
// two release functions in this process with a stubbed fetch and fake Bunny
// credentials, so no real request can ever leave the machine — the server
// process can't be observed from here, and the real storage key must never be
// involved in a test that would (on unfixed code) issue deletes.
test.describe("lib/bunny never issues a Bunny DELETE while deletion is switched off", () => {
  test("releaseEventImage and releaseRoomImage make no fetch call", async () => {
    const saved = { ...process.env };
    const realFetch = globalThis.fetch;
    const calls: unknown[][] = [];

    // lib/db reads DATABASE_URL at import time; on unfixed code the
    // "still used?" lookup runs before the DELETE, so it needs the test branch.
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.BUNNY_STORAGE_ZONE = "test-zone";
    process.env.BUNNY_STORAGE_KEY = "test-key";
    process.env.BUNNY_CDN_HOST = "cdn.test.invalid";
    globalThis.fetch = (async (...args: unknown[]) => {
      calls.push(args);
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    try {
      // require(), not import(): Playwright resolves the "@/…" path alias for
      // require()d TypeScript, but not for a dynamic import(). It also has to
      // run after DATABASE_URL is set above, which a static import can't guarantee.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { releaseEventImage, releaseRoomImage } = require("../../lib/bunny") as typeof import("../../lib/bunny");
      const url = "https://cdn.test.invalid/some-slug/0123456789abcdef01234567.webp";
      await releaseEventImage(url, "no-such-client", "no-such-event");
      await releaseRoomImage(url, "no-such-client", "no-such-room");
      // The dangerous shapes from the audit, too — none may reach the network.
      await releaseEventImage("https://cdn.test.invalid/?allowRootDelete=true", "no-such-client", "no-such-event");
      await releaseRoomImage("https://cdn.test.invalid/other-slug/", "no-such-client", "no-such-room");
      expect(calls).toHaveLength(0);
    } finally {
      globalThis.fetch = realFetch;
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  });
});
