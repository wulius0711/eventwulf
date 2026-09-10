import { test, expect } from "@playwright/test";
import { getStoredTheme, setStoredTheme } from "../../components/admin/ThemeToggle";

// Regression test for Medium finding 10 (Durchgang 3, part 3): ThemeToggle's
// localStorage reads/writes had no error handling — in contexts where it's
// unavailable or restricted (Safari ITP, embedded iframe widgets, private
// browsing), a throw there broke the component instead of just running
// without persistence. Runs in Node (like every other test in this suite —
// none use a real browser page), with a fake localStorage installed on
// globalThis that throws on every access, exercising the exact functions the
// component calls without needing a full authenticated browser session for
// what is a small, pure piece of guard logic.
test.describe("ThemeToggle localStorage guards", () => {
  test("getStoredTheme falls back to false instead of throwing", async () => {
    const original = (globalThis as { localStorage?: Storage }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error("localStorage unavailable");
      },
    };
    try {
      expect(() => getStoredTheme()).not.toThrow();
      expect(getStoredTheme()).toBe(false);
    } finally {
      (globalThis as { localStorage?: Storage }).localStorage = original;
    }
  });

  test("setStoredTheme does not throw when persistence fails", async () => {
    const original = (globalThis as { localStorage?: Storage }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = {
      setItem: () => {
        throw new Error("localStorage unavailable");
      },
    };
    try {
      expect(() => setStoredTheme(true)).not.toThrow();
    } finally {
      (globalThis as { localStorage?: Storage }).localStorage = original;
    }
  });

  test("both still work normally when localStorage is available", async () => {
    const store = new Map<string, string>();
    const original = (globalThis as { localStorage?: Storage }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    try {
      setStoredTheme(true);
      expect(getStoredTheme()).toBe(true);
      setStoredTheme(false);
      expect(getStoredTheme()).toBe(false);
    } finally {
      (globalThis as { localStorage?: Storage }).localStorage = original;
    }
  });
});
