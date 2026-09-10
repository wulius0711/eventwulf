import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, loginAsTestAdmin, createTestInquiry, deleteTestOrganization } from "../helpers/fixtures";

// Regression test for Medium finding 7 (Durchgang 2, part 1): InvoiceCounter
// was keyed purely by year ("angebot-2026"), shared across every client —
// gaps in one client's own invoice number sequence leaked information about
// total cross-tenant invoice volume in the same period. The counter key now
// includes clientId, so each client's numbering is fully independent and
// restarts at 1.
test.describe("Invoice counter is scoped per client", () => {
  // These three cases build on each other's counter state on purpose (second
  // offer continues the sequence, concurrent pair continues it further) —
  // serial like the other order-dependent suites in this project
  // (fullyParallel: true would otherwise let them run out of order).
  test.describe.configure({ mode: "serial" });
  let orgA: Awaited<ReturnType<typeof createTestClientWithAdmin>>;
  let orgB: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

  test.beforeAll(async () => {
    orgA = await createTestClientWithAdmin();
    orgB = await createTestClientWithAdmin();
  });

  test.afterAll(async () => {
    await deleteTestOrganization(orgA.organization.id, orgA.client.id);
    await deleteTestOrganization(orgB.organization.id, orgB.client.id);
  });

  async function createOffer(request: import("@playwright/test").APIRequestContext, org: typeof orgA, email: string, password: string) {
    await loginAsTestAdmin(request, email, password);
    const inquiry = await createTestInquiry(org.client.id, { status: "neu" });
    const res = await request.post("/api/admin/invoices", {
      data: {
        inquiryId: inquiry.id,
        updatedAt: inquiry.updatedAt.toISOString(),
        lineItems: [{ description: "Test", quantity: 1, unitPrice: 100 }],
        sendEmail: false,
      },
    });
    expect(res.ok()).toBe(true);
    return res.json();
  }

  test("two different clients each get their own number 1, no collision or cross-influence", async ({ request }) => {
    const invoiceA = await createOffer(request, orgA, orgA.email, orgA.password);
    const invoiceB = await createOffer(request, orgB, orgB.email, orgB.password);

    const year = new Date().getFullYear();
    expect(invoiceA.number).toBe(`ANB-${year}-0001`);
    expect(invoiceB.number).toBe(`ANB-${year}-0001`);

    const counters = await prisma.invoiceCounter.findMany({
      where: { id: { in: [`${orgA.client.id}-${year}`, `${orgB.client.id}-${year}`] } },
    });
    expect(counters).toHaveLength(2);
    for (const c of counters) expect(c.counter).toBe(1);
  });

  test("a second offer for the same client continues that client's own sequence", async ({ request }) => {
    await loginAsTestAdmin(request, orgA.email, orgA.password);
    const inquiry = await createTestInquiry(orgA.client.id, { status: "neu" });
    const res = await request.post("/api/admin/invoices", {
      data: {
        inquiryId: inquiry.id,
        updatedAt: inquiry.updatedAt.toISOString(),
        lineItems: [{ description: "Test", quantity: 1, unitPrice: 100 }],
        sendEmail: false,
      },
    });
    expect(res.ok()).toBe(true);
    const invoice = await res.json();
    const year = new Date().getFullYear();
    expect(invoice.number).toBe(`ANB-${year}-0002`);
  });

  test("two concurrent offers for the same client still get distinct, gapless numbers", async ({ request }) => {
    await loginAsTestAdmin(request, orgB.email, orgB.password);
    const [inquiry1, inquiry2] = await Promise.all([
      createTestInquiry(orgB.client.id, { status: "neu" }),
      createTestInquiry(orgB.client.id, { status: "neu" }),
    ]);

    const [res1, res2] = await Promise.all([
      request.post("/api/admin/invoices", {
        data: {
          inquiryId: inquiry1.id,
          updatedAt: inquiry1.updatedAt.toISOString(),
          lineItems: [{ description: "Test", quantity: 1, unitPrice: 100 }],
          sendEmail: false,
        },
      }),
      request.post("/api/admin/invoices", {
        data: {
          inquiryId: inquiry2.id,
          updatedAt: inquiry2.updatedAt.toISOString(),
          lineItems: [{ description: "Test", quantity: 1, unitPrice: 100 }],
          sendEmail: false,
        },
      }),
    ]);

    expect(res1.ok()).toBe(true);
    expect(res2.ok()).toBe(true);
    const [invoice1, invoice2] = await Promise.all([res1.json(), res2.json()]);
    expect(invoice1.number).not.toBe(invoice2.number);

    const year = new Date().getFullYear();
    const numbers = [invoice1.number, invoice2.number].sort();
    // Started this client's counter at 1 in the previous test — this pair
    // must be the next two, consecutive and gapless.
    expect(numbers).toEqual([`ANB-${year}-0002`, `ANB-${year}-0003`]);
  });
});
