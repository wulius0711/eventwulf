import { prisma } from "@/lib/db";

export async function nextInvoiceNumber(clientId: string): Promise<string> {
  const year = new Date().getFullYear();
  // Scoped per client, not just per year — a single shared counter let gaps
  // in one client's own sequence leak information about total cross-tenant
  // invoice volume in the same period (Medium finding 7).
  const key = `${clientId}-${year}`;

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.invoiceCounter.upsert({
      where: { id: key },
      update: { counter: { increment: 1 } },
      create: { id: key, counter: 1 },
    });
    return row.counter;
  });

  return `ANB-${year}-${String(result).padStart(4, "0")}`;
}
