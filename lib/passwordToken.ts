import { hashSync } from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { validatePassword } from "@/lib/validate";

// Reset links reuse the user's inviteToken columns (one active link per user),
// so no schema change is needed. A reset link is short-lived.
export const RESET_TTL_MS = 60 * 60 * 1000;

export async function findUserByToken(token: unknown) {
  if (typeof token !== "string" || !token) return null;
  const user = await prisma.user.findUnique({ where: { inviteToken: token } });
  if (!user || !user.inviteTokenExpiresAt || user.inviteTokenExpiresAt < new Date()) return null;
  return user;
}

export type SetPasswordResult =
  | { ok: true; sessionToken: string }
  | { ok: false; status: number; error: string };

// Sets a new password from a valid token and signs the user in. The token is
// single-use, and passwordChangedAt invalidates every session issued before.
export async function setPasswordFromToken(token: unknown, password: unknown): Promise<SetPasswordResult> {
  const user = await findUserByToken(token);
  if (!user) return { ok: false, status: 400, error: "Link ungültig oder abgelaufen" };

  const pwError = validatePassword(password);
  if (pwError) return { ok: false, status: 400, error: pwError };
  if (!user.organizationId) return { ok: false, status: 404, error: "Organisation nicht gefunden" };

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    include: { clients: { select: { slug: true }, orderBy: { createdAt: "asc" }, take: 1 } },
  });
  const clientSlug = org?.clients[0]?.slug;
  if (!clientSlug) return { ok: false, status: 500, error: "Organisation nicht vollständig eingerichtet" };

  const passwordChangedAt = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashSync(password as string, 12), passwordChangedAt, inviteToken: null, inviteTokenExpiresAt: null },
  });

  const sessionToken = await signToken({
    userId: user.id,
    organizationId: user.organizationId,
    clientSlug,
    email: user.email,
    pwChangedAt: passwordChangedAt.getTime(),
  });
  return { ok: true, sessionToken };
}
