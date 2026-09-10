import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, loginAsTestAdmin, createTestInquiry, deleteTestOrganization } from "../helpers/fixtures";

// Regression test for Fund 7 (part b): /api/admin/invoices had no server-side
// validation of lineItems beyond "array is not empty" — quantity and
// unitPrice could be any value, including negative, producing negative
// billed amounts. This is independent of participantCount: line items are
// fully admin-editable free-form input, so validation runs on what's
// actually submitted, not on an assumption about where the values came from.
test.describe("Invoice line item validation in /api/admin/invoices", () => {
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  async function submitLineItems(request: import("@playwright/test").APIRequestContext, lineItems: unknown) {
    const inquiry = await createTestInquiry(org.client.id, { status: "neu" });
    const res = await request.post("/api/admin/invoices", {
      data: { inquiryId: inquiry.id, updatedAt: inquiry.updatedAt.toISOString(), lineItems, sendEmail: false },
    });
    return { res, inquiry };
  }

  test("rejects a negative quantity, creates no invoice", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const { res, inquiry } = await submitLineItems(request, [{ description: "Test", quantity: -1, unitPrice: 50 }]);
    expect(res.status()).toBe(400);
    expect(await prisma.invoice.findMany({ where: { inquiryId: inquiry.id } })).toHaveLength(0);
  });

  test("rejects a non-integer quantity, creates no invoice", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const { res, inquiry } = await submitLineItems(request, [{ description: "Test", quantity: 1.5, unitPrice: 50 }]);
    expect(res.status()).toBe(400);
    expect(await prisma.invoice.findMany({ where: { inquiryId: inquiry.id } })).toHaveLength(0);
  });

  test("rejects a negative unit price, creates no invoice", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const { res, inquiry } = await submitLineItems(request, [{ description: "Test", quantity: 2, unitPrice: -10 }]);
    expect(res.status()).toBe(400);
    expect(await prisma.invoice.findMany({ where: { inquiryId: inquiry.id } })).toHaveLength(0);
  });

  test("accepts valid line items", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);
    const { res, inquiry } = await submitLineItems(request, [{ description: "Test", quantity: 3, unitPrice: 25 }]);
    expect(res.status()).toBe(200);
    expect(await prisma.invoice.findMany({ where: { inquiryId: inquiry.id } })).toHaveLength(1);
  });
});
