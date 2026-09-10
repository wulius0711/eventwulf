import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, loginAsTestAdmin, deleteTestOrganization, isoDateInDays } from "../helpers/fixtures";

// Regression test for Medium finding 5 (Durchgang 3, part 1): minParticipants
// validation differed between create and edit — not two different rules, a
// gap that only existed on edit. Create silently coerced non-positive/
// non-numeric input to 1 via `Number(x) || 1`, which caught 0 and NaN but
// missed negative values entirely (Number(-5) || 1 is still -5, since -5 is
// truthy). Edit had no coercion or validation at all, writing 0, negative
// numbers, or even NaN straight into the DB. Both now share
// validateMinParticipants (lib/validate.ts) and reject invalid input
// explicitly instead of silently defaulting or writing garbage.
test.describe("minParticipants validation is consistent between create and edit", () => {
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  function payload(overrides: Record<string, unknown>) {
    return {
      name: "Test Event",
      startDate: isoDateInDays(10),
      endDate: isoDateInDays(10),
      ...overrides,
    };
  }

  test("create rejects a negative minParticipants", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.post("/api/admin/events", { data: payload({ minParticipants: -5 }) });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Min. Teilnehmer muss eine positive ganze Zahl sein");
  });

  test("create rejects a non-numeric minParticipants", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.post("/api/admin/events", { data: payload({ minParticipants: "abc" }) });
    expect(res.status()).toBe(400);
  });

  test("edit rejects a negative minParticipants", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const created = await request.post("/api/admin/events", { data: payload({ minParticipants: 2 }) });
    const event = await created.json();

    const res = await request.patch("/api/admin/events", { data: { id: event.id, minParticipants: -3 } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Min. Teilnehmer muss eine positive ganze Zahl sein");

    const reloaded = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(reloaded.minParticipants).toBe(2); // unchanged, not overwritten with garbage
  });

  test("edit rejects a zero minParticipants", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const created = await request.post("/api/admin/events", { data: payload({ minParticipants: 2 }) });
    const event = await created.json();

    const res = await request.patch("/api/admin/events", { data: { id: event.id, minParticipants: 0 } });
    expect(res.status()).toBe(400);
  });

  test("edit rejects minParticipants above maxParticipants", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const created = await request.post("/api/admin/events", { data: payload({ minParticipants: 2, maxParticipants: 10 }) });
    const event = await created.json();

    const res = await request.patch("/api/admin/events", { data: { id: event.id, minParticipants: 20 } });
    expect(res.status()).toBe(400);
  });

  test("both accept a valid positive minParticipants", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const created = await request.post("/api/admin/events", { data: payload({ minParticipants: 3 }) });
    expect(created.ok()).toBe(true);
    const event = await created.json();
    expect(event.minParticipants).toBe(3);

    const edited = await request.patch("/api/admin/events", { data: { id: event.id, minParticipants: 5 } });
    expect(edited.ok()).toBe(true);
    const editedEvent = await edited.json();
    expect(editedEvent.minParticipants).toBe(5);
  });
});
