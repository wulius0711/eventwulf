import { test, expect } from "@playwright/test";
import { weekBlockedRange, type CalendarDay } from "@/components/Calendar";
import type { BlockedDateEntry } from "@/lib/types";

// Regression test for a functional UI bug (not a security finding, so no
// live-key/rot-grün ritual needed here — a plain positive/negative check):
// the calendar widget's "Sperrzeit" banner always showed the hardcoded text
// "nicht verfügbar", ignoring whatever label an admin actually entered in
// AvailabilityEditor. Root cause: weekBlockedRange() (used by both the
// admin preview and the public booking widget) only ever computed
// {start, end} column indices for the banner's position — it never
// carried the matching BlockedDate entry's label along, so the render
// side had nothing to show but a hardcoded fallback. Fixed by having
// weekBlockedRange() also return the label (and date range, for the
// hover tooltip added to match the sibling event banner) of whichever
// entry produced the earliest blocked day in that week.
function day(iso: string): CalendarDay {
  return { date: new Date(`${iso}T00:00:00`), inMonth: true };
}

function week(isos: string[]): CalendarDay[] {
  return isos.map(day);
}

function blockedEntry(overrides: Partial<BlockedDateEntry> & { startDate: string; endDate: string; label: string }): BlockedDateEntry {
  return { id: "test-id", type: "blocked", color: "", ...overrides };
}

test.describe("weekBlockedRange — Sperrzeit label reaches the calendar banner", () => {
  test("a labeled Sperrzeit's real name is returned, not a hardcoded default", () => {
    const w = week(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    const entries = [blockedEntry({ startDate: "2026-11-03", endDate: "2026-11-05", label: "Betriebsurlaub" })];

    const result = weekBlockedRange(w, entries);

    expect(result).not.toBeNull();
    expect(result?.label).toBe("Betriebsurlaub");
    expect(result?.start).toBe(1);
    expect(result?.end).toBe(3);
  });

  test("no blocked entries in the week: no banner at all", () => {
    const w = week(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(weekBlockedRange(w, [])).toBeNull();
  });

  test("a silent block (e.g. a room's own Event) is excluded from this banner, same as before the fix", () => {
    const w = week(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    const entries = [blockedEntry({ startDate: "2026-11-03", endDate: "2026-11-03", label: "Sollte nicht erscheinen", silent: true })];
    expect(weekBlockedRange(w, entries)).toBeNull();
  });

  test("two distinct Sperrzeiten in the same week: known limitation — only the earliest entry's label is shown (documented, not a regression)", () => {
    const w = week(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    const entries = [
      blockedEntry({ startDate: "2026-11-02", endDate: "2026-11-02", label: "Montag zu" }),
      blockedEntry({ startDate: "2026-11-06", endDate: "2026-11-06", label: "Freitag zu" }),
    ];

    const result = weekBlockedRange(w, entries);

    expect(result?.label).toBe("Montag zu");
    // The merged bar still spans from the first to the last blocked day —
    // this pre-existing visual simplification is unchanged by this fix.
    expect(result?.start).toBe(0);
    expect(result?.end).toBe(4);
  });

  test("an entry with no label falls back to an empty string here (the render side applies the 'nicht verfügbar' default, not this function)", () => {
    const w = week(["2026-11-02", "2026-11-03"]);
    const entries = [blockedEntry({ startDate: "2026-11-02", endDate: "2026-11-02", label: "" })];
    expect(weekBlockedRange(w, entries)?.label).toBe("");
  });
});
