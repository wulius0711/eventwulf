import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { signToken, cookieName, cookieOptions } from '@/lib/auth';

const TOKEN_TTL_MS = 60_000;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const orgId = searchParams.get('orgId');
  const ts = searchParams.get('ts');
  const sig = searchParams.get('sig');

  if (!orgId || !ts || !sig) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const timestamp = parseInt(ts, 10);
  if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_TTL_MS) {
    return NextResponse.json({ error: 'Token expired' }, { status: 401 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      clients: { select: { slug: true }, orderBy: { createdAt: 'asc' }, take: 1 },
      users: { select: { id: true, email: true, passwordChangedAt: true }, take: 1 },
    },
  });

  if (!org?.bookingAppKey) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const expected = createHmac('sha256', org.bookingAppKey)
    .update(`autologin:${orgId}:${ts}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const valid = sigBuf.length === expectedBuf.length && timingSafeEqual(expectedBuf, sigBuf);

  if (!valid) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Replay guard: the INSERT with a unique constraint on tokenHash is itself
  // the atomic check-and-insert — two near-simultaneous requests for the
  // same token can't both succeed, one always loses to the constraint
  // (same principle as Block B's conditional updates, applied to an insert
  // instead of an update). sig is unforgeable without bookingAppKey and
  // unique per (orgId, ts), so hashing it (not storing it raw) is the
  // natural replay key here — there's no single opaque "the token" value in
  // this HMAC-query-param scheme.
  const tokenHash = createHash('sha256').update(sig).digest('hex');
  try {
    await prisma.usedAutologinToken.create({
      data: { tokenHash, expiresAt: new Date(timestamp + TOKEN_TTL_MS + 5_000) },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Token already used' }, { status: 401 });
    }
    throw e;
  }

  const user = org.users[0];
  const clientSlug = org.clients[0]?.slug ?? '';
  if (!user || !clientSlug) {
    return NextResponse.json({ error: 'Org not fully provisioned' }, { status: 500 });
  }

  const token = await signToken({
    userId: user.id,
    organizationId: org.id,
    clientSlug,
    email: user.email,
    pwChangedAt: user.passwordChangedAt?.getTime() ?? 0,
  });

  const res = NextResponse.redirect(new URL('/admin', req.url));
  res.cookies.set(cookieName(), token, cookieOptions());
  return res;
}
