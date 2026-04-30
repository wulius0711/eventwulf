import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { signToken, cookieName } from '@/lib/auth';

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
      users: { select: { id: true, email: true }, take: 1 },
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
  });

  const res = NextResponse.redirect(new URL('/admin', req.url));
  res.cookies.set(cookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return res;
}
