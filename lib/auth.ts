import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET environment variable is required");
  return new TextEncoder().encode(s);
}
const COOKIE = "event_admin_token";

export interface AdminSession {
  userId: string;
  organizationId: string;
  clientSlug: string;
  email: string;
  // Snapshot of the user's passwordChangedAt at token issuance (0 if never
  // changed) — compared against the live DB value on every session check, so
  // a password change invalidates every token issued before it, not just
  // ones that happen to expire naturally up to 7 days later (Medium finding 8).
  pwChangedAt: number;
}

export async function signToken(payload: AdminSession): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as AdminSession;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const session = await verifyToken(token);
  if (!session) return null;

  // Extra DB read on every authenticated request — the deliberate cost of
  // being able to invalidate a session at all, not just let it expire on its
  // own. Also closes a related gap for free: a deleted user's token stops
  // working immediately instead of staying valid until it naturally expires.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { passwordChangedAt: true },
  });
  if (!user) return null;

  const currentPwChangedAt = user.passwordChangedAt?.getTime() ?? 0;
  if (session.pwChangedAt !== currentPwChangedAt) return null;

  return session;
}

export function cookieName() {
  return COOKIE;
}

export function cookieOptions(maxAge = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}
