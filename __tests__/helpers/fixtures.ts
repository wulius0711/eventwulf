import { randomBytes } from "crypto";
import { prisma } from "./testDb";

export function randomSlug(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}

export function isoDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function createTestClient(opts?: { slug?: string; notifyEmail?: string }) {
  const slug = opts?.slug ?? randomSlug("test-client");
  const config = JSON.stringify({
    company: { name: `Test Org ${slug}` },
    notifyEmail: opts?.notifyEmail ?? "notify@example.com",
  });
  return prisma.client.create({ data: { slug, config } });
}

export async function createTestRoom(clientId: string, overrides?: { name?: string; capacity?: number }) {
  return prisma.room.create({
    data: {
      clientId,
      name: overrides?.name ?? "Test Room",
      capacity: overrides?.capacity ?? 20,
      isActive: true,
    },
  });
}

export async function createTestEvent(
  clientId: string,
  overrides?: { name?: string; startDate?: Date; endDate?: Date; minParticipants?: number; maxParticipants?: number | null }
) {
  return prisma.event.create({
    data: {
      clientId,
      name: overrides?.name ?? "Test Event",
      startDate: overrides?.startDate ?? new Date(Date.now() + 30 * 86400000),
      endDate: overrides?.endDate ?? new Date(Date.now() + 31 * 86400000),
      isActive: true,
      minParticipants: overrides?.minParticipants ?? 1,
      maxParticipants: overrides?.maxParticipants ?? null,
    },
  });
}

// Deletes in FK-safe order: Inquiry has no onDelete on its Client relation
// (Room/Event do cascade), so it must go first or the Client delete fails.
export async function deleteTestClient(clientId: string) {
  await prisma.inquiry.deleteMany({ where: { clientId } });
  await prisma.event.deleteMany({ where: { clientId } });
  await prisma.room.deleteMany({ where: { clientId } });
  await prisma.client.delete({ where: { id: clientId } });
}
