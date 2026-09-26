import { test, expect } from "@playwright/test";
import { randomBytes } from "crypto";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, createTestRoom, deleteTestOrganization } from "../helpers/fixtures";

// Regression test for audit 2026-09-26, H2 (part 1): /api/availability is
// public and used to return each confirmed room booking's Inquiry id, which
// (via the unauthenticated /api/ical/[id]) let anyone read the guest's name,
// event title and participant count. The id must not appear in the response
// at all — and the calendar must keep blocking the booked days, since it
// never read that field.
function pad(n: number) {
  return String(n).padStart(2, "0");
}

// The 15th of next month: always in the future, and the number 15 appears
// exactly once in that month's calendar grid (leading/trailing days of the
// adjacent months are 1-6 and 22-31).
function nextMonth15th() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  return { iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-15` };
}

test.describe("Public availability does not expose inquiry ids", () => {
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;
  let room: Awaited<ReturnType<typeof createTestRoom>>;
  let confirmedId: string;
  let pendingId: string;
  const bookedDate = nextMonth15th().iso;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "pro" } });
    room = await createTestRoom(org.client.id, { name: "Availability Testraum" });

    const make = (status: string) =>
      prisma.inquiry.create({
        data: {
          clientId: org.client.id,
          roomId: room.id,
          status,
          participantCount: 5,
          cancelToken: randomBytes(24).toString("hex"),
          data: JSON.stringify({
            artTitel: "Vertraulicher Workshop",
            nameGruppenleitung: "Erika Geheim",
            email: "erika.geheim@example.com",
            personenAnzahl: "5",
            datumVon: bookedDate,
            datumBis: bookedDate,
          }),
        },
      });
    confirmedId = (await make("bestaetigt")).id;
    pendingId = (await make("neu")).id;
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("the response for a room with a confirmed booking contains no inquiry id or guest data", async ({ request }) => {
    const res = await request.get(`/api/availability?slug=${org.client.slug}&roomId=${room.id}`);
    expect(res.ok()).toBe(true);
    const raw = await res.text();

    expect(raw).not.toContain(confirmedId);
    expect(raw).not.toContain(pendingId);
    expect(raw).not.toContain("Erika Geheim");
    expect(raw).not.toContain("Vertraulicher Workshop");
    expect(raw).not.toContain("cancelToken");

    // The occupancy itself is still reported, with everything the calendar reads.
    const entries = JSON.parse(raw) as Array<Record<string, unknown>>;
    const booked = entries.filter((e) => e.label === "Raum belegt");
    expect(booked).toHaveLength(1); // only the confirmed one blocks, not the pending one
    expect(booked[0].startDate).toBe(`${bookedDate}T00:00:00.000Z`);
    expect(booked[0].endDate).toBe(`${bookedDate}T00:00:00.000Z`);
    expect(booked[0].type).toBe("blocked");
    expect(booked[0].intern).toBe(true);
    expect(booked[0]).not.toHaveProperty("id");
  });

  test("the widget calendar still blocks the booked day for that room", async ({ page }) => {
    await page.goto(`/?kunde=${org.client.slug}`);

    // Selecting the room refetches availability with roomId — wait for exactly that.
    const availability = page.waitForResponse((r) => r.url().includes("/api/availability") && r.url().includes(`roomId=${room.id}`));
    await page.getByRole("button", { name: /Availability Testraum/ }).click();
    expect((await availability).ok()).toBe(true);

    await page.getByRole("button", { name: "Nächster Monat" }).click();

    // Day cells: free days carry the "ew-cal-day" class, blocked/past ones don't
    // (and show cursor: not-allowed). The number is in a span inside the cell.
    const cellOf = (day: string) => page.getByText(day, { exact: true }).locator("xpath=..");
    await expect(cellOf("16")).toHaveClass(/ew-cal-day/); // free neighbour — proves the check isn't vacuous
    await expect(cellOf("15")).not.toHaveClass(/ew-cal-day/);
    await expect(cellOf("15")).toHaveCSS("cursor", "not-allowed");
  });
});
