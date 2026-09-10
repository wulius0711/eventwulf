import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import {
  createTestClientWithAdmin,
  loginAsTestAdmin,
  createTestEvent,
  createTestInquiry,
  deleteTestOrganization,
} from "../helpers/fixtures";

// Regression test for Fund 5: the admin PATCH endpoint (and, as a second,
// independently found instance of the same bug, the invoice-creation POST
// endpoint) wrote Inquiry.status by id with no check that the record was
// still in the state the admin loaded it in — silent last-write-wins. Both
// now guard the write with the updatedAt the client loaded (Inquiry.updatedAt,
// added in this phase's migration), returning 409 on a stale write instead
// of overwriting a concurrent change.
test.describe("Optimistic concurrency on admin inquiry updates", () => {
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("PATCH rejects a status update against a stale updatedAt", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);

    const inquiry = await createTestInquiry(org.client.id, { status: "neu" });
    const staleUpdatedAt = inquiry.updatedAt.toISOString();

    // Someone else changes the record in the meantime.
    const firstWrite = await request.patch("/api/admin/inquiries", {
      data: { id: inquiry.id, status: "in_pruefung", updatedAt: staleUpdatedAt },
    });
    expect(firstWrite.status()).toBe(200);

    // A second write using the now-stale updatedAt must be rejected, not overwrite it.
    const secondWrite = await request.patch("/api/admin/inquiries", {
      data: { id: inquiry.id, status: "bestaetigt", updatedAt: staleUpdatedAt },
    });
    expect(secondWrite.status()).toBe(409);

    const reloaded = await prisma.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } });
    expect(reloaded.status).toBe("in_pruefung");
  });

  test("two concurrent PATCH requests never both reserve capacity for the same inquiry", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);

    // Generous capacity (20) relative to participantCount (6): if both
    // concurrent requests reserved capacity independently, bookedCount would
    // wrongly reach 12 — nothing here would fail on capacity grounds alone,
    // so a passing test actually proves the conflict guard, not just that
    // the event happened to be full.
    const event = await createTestEvent(org.client.id, { maxParticipants: 20 });
    const inquiry = await createTestInquiry(org.client.id, {
      eventId: event.id,
      status: "abgelehnt", // not held — the transition below must reserve capacity
      participantCount: 6,
    });
    const loadedUpdatedAt = inquiry.updatedAt.toISOString();

    const [a, b] = await Promise.all([
      request.patch("/api/admin/inquiries", { data: { id: inquiry.id, status: "bestaetigt", updatedAt: loadedUpdatedAt } }),
      request.patch("/api/admin/inquiries", { data: { id: inquiry.id, status: "bestaetigt", updatedAt: loadedUpdatedAt } }),
    ]);
    const statuses = [a.status(), b.status()].sort((x, y) => x - y);

    expect(statuses).toEqual([200, 409]);

    const reloadedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(reloadedEvent.bookedCount).toBe(6); // not 12
  });
});

test.describe("Optimistic concurrency on invoice creation (Fix A) + capacity on offer creation (Fund B)", () => {
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  function lineItems() {
    return [{ description: "Testposition", quantity: 1, unitPrice: 100 }];
  }

  test("Fix A: rejects invoice creation against a stale updatedAt, creates no invoice", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);

    const inquiry = await createTestInquiry(org.client.id, { status: "neu" });
    const staleUpdatedAt = inquiry.updatedAt.toISOString();

    // Concurrent change by someone else, bypassing the HTTP layer on purpose
    // to isolate this from the PATCH endpoint's own (already tested) guard.
    await prisma.inquiry.update({ where: { id: inquiry.id }, data: { status: "abgelehnt" } });

    const res = await request.post("/api/admin/invoices", {
      data: { inquiryId: inquiry.id, updatedAt: staleUpdatedAt, lineItems: lineItems(), sendEmail: false },
    });
    expect(res.status()).toBe(409);

    const invoices = await prisma.invoice.findMany({ where: { inquiryId: inquiry.id } });
    expect(invoices).toHaveLength(0);

    const reloaded = await prisma.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } });
    expect(reloaded.status).toBe("abgelehnt");
  });

  test("two concurrent invoice-creation POSTs never both reserve capacity for the same inquiry", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);

    // Same reasoning as the PATCH concurrency test above: generous capacity
    // (20) relative to participantCount (6) means nothing here fails on
    // capacity grounds alone — only the updatedAt guard can produce a 409.
    const event = await createTestEvent(org.client.id, { maxParticipants: 20 });
    const inquiry = await createTestInquiry(org.client.id, {
      eventId: event.id,
      status: "abgelehnt",
      participantCount: 6,
    });
    const loadedUpdatedAt = inquiry.updatedAt.toISOString();
    const payload = { inquiryId: inquiry.id, updatedAt: loadedUpdatedAt, lineItems: lineItems(), sendEmail: false };

    const [a, b] = await Promise.all([
      request.post("/api/admin/invoices", { data: payload }),
      request.post("/api/admin/invoices", { data: payload }),
    ]);
    const statuses = [a.status(), b.status()].sort((x, y) => x - y);

    expect(statuses).toEqual([200, 409]);

    const reloadedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(reloadedEvent.bookedCount).toBe(6); // not 12

    // The losing request's invoice.create() ran before the updatedAt guard
    // failed, inside the same transaction — it must have rolled back too.
    const invoices = await prisma.invoice.findMany({ where: { inquiryId: inquiry.id } });
    expect(invoices).toHaveLength(1);
  });

  test("Fund B: creating an offer for a non-held inquiry reserves capacity", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);

    const event = await createTestEvent(org.client.id, { maxParticipants: 10 });
    const inquiry = await createTestInquiry(org.client.id, {
      eventId: event.id,
      status: "abgelehnt", // not held
      participantCount: 4,
    });

    const res = await request.post("/api/admin/invoices", {
      data: { inquiryId: inquiry.id, updatedAt: inquiry.updatedAt.toISOString(), lineItems: lineItems(), sendEmail: false },
    });
    expect(res.status()).toBe(200);

    const reloadedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(reloadedEvent.bookedCount).toBe(4);

    const reloadedInquiry = await prisma.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } });
    expect(reloadedInquiry.status).toBe("angebot_versendet");
  });

  test("Fund B: refuses to create an offer that would exceed remaining capacity, creates no invoice", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);

    const event = await createTestEvent(org.client.id, { maxParticipants: 3 });
    const inquiry = await createTestInquiry(org.client.id, {
      eventId: event.id,
      status: "abgelehnt",
      participantCount: 4, // exceeds the event's total capacity
    });

    const res = await request.post("/api/admin/invoices", {
      data: { inquiryId: inquiry.id, updatedAt: inquiry.updatedAt.toISOString(), lineItems: lineItems(), sendEmail: false },
    });
    expect(res.status()).toBe(400);

    const invoices = await prisma.invoice.findMany({ where: { inquiryId: inquiry.id } });
    expect(invoices).toHaveLength(0);

    const reloadedInquiry = await prisma.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } });
    expect(reloadedInquiry.status).toBe("abgelehnt"); // rolled back, not flipped

    const reloadedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(reloadedEvent.bookedCount).toBe(0);
  });
});
