import { randomBytes } from "crypto";
import { hashSync } from "bcryptjs";
import type { APIRequestContext } from "@playwright/test";
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

export async function createTestInquiry(
  clientId: string,
  overrides?: {
    eventId?: string;
    roomId?: string;
    status?: string;
    participantCount?: number;
    holdExpiresAt?: Date | null;
  }
) {
  return prisma.inquiry.create({
    data: {
      clientId,
      data: JSON.stringify({ datumVon: isoDateInDays(20), datumBis: isoDateInDays(20) }),
      status: overrides?.status ?? "neu",
      participantCount: overrides?.participantCount ?? 1,
      cancelToken: randomBytes(24).toString("hex"),
      ...(overrides?.eventId ? { eventId: overrides.eventId } : {}),
      ...(overrides?.roomId ? { roomId: overrides.roomId } : {}),
      holdExpiresAt: overrides?.holdExpiresAt ?? null,
    },
  });
}

// Admin-authenticated tests need a full Organization + User + Client chain —
// /api/admin/login resolves the session's clientSlug via user.organization.clients[0].
const TEST_ADMIN_PASSWORD = "TestPass123!";

export async function createTestClientWithAdmin(opts?: { slug?: string; notifyEmail?: string }) {
  const slug = opts?.slug ?? randomSlug("test-client");
  const email = `${slug}@example.com`;
  const config = JSON.stringify({
    company: { name: `Test Org ${slug}` },
    notifyEmail: opts?.notifyEmail ?? "notify@example.com",
  });

  const organization = await prisma.organization.create({
    data: {
      name: slug,
      clients: { create: { slug, config } },
      users: { create: { email, password: hashSync(TEST_ADMIN_PASSWORD, 12) } },
    },
    include: { clients: true, users: true },
  });

  return { organization, client: organization.clients[0], user: organization.users[0], email, password: TEST_ADMIN_PASSWORD };
}

export async function loginAsTestAdmin(request: APIRequestContext, email: string, password: string) {
  const res = await request.post("/api/admin/login", { data: { email, password } });
  if (!res.ok()) throw new Error(`Test admin login failed: ${res.status()} ${await res.text()}`);
}

// Deletes in FK-safe order: Inquiry has no onDelete on its Client relation
// (Room/Event do cascade), so it must go first or the Client delete fails.
// Invoice has onDelete: Cascade from Inquiry, so it's covered by the inquiry delete.
export async function deleteTestClient(clientId: string) {
  await prisma.inquiry.deleteMany({ where: { clientId } });
  await prisma.event.deleteMany({ where: { clientId } });
  await prisma.room.deleteMany({ where: { clientId } });
  await prisma.client.delete({ where: { id: clientId } });
}

export async function deleteTestOrganization(organizationId: string, clientId: string) {
  await deleteTestClient(clientId);
  await prisma.user.deleteMany({ where: { organizationId } });
  await prisma.organization.delete({ where: { id: organizationId } });
}
