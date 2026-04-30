import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { hashSync } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { loadConfig } from '@/lib/loadConfig';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!secret || secret !== process.env.PROVISIONING_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, email, bookingAppUrl } = await req.json();
  if (!name || !email) {
    return NextResponse.json({ error: 'name and email required' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });

  if (existing?.organization) {
    const org = existing.organization;
    const updates: Record<string, string> = {};
    if (bookingAppUrl && org.bookingAppUrl !== bookingAppUrl) updates.bookingAppUrl = bookingAppUrl;
    let key = org.bookingAppKey;
    if (!key) { key = randomBytes(32).toString('hex'); updates.bookingAppKey = key; }
    if (Object.keys(updates).length) {
      await prisma.organization.update({ where: { id: org.id }, data: updates });
    }
    return NextResponse.json({ orgId: org.id, bookingAppKey: key });
  }

  const bookingAppKey = randomBytes(32).toString('hex');
  const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + randomBytes(3).toString('hex');
  const defaultConfig = loadConfig('default');

  const org = await prisma.organization.create({
    data: {
      name,
      bookingAppUrl: bookingAppUrl ?? null,
      bookingAppKey,
      clients: { create: { slug, config: JSON.stringify(defaultConfig) } },
      users: { create: { email, password: hashSync(randomBytes(32).toString('hex'), 12) } },
    },
  });

  return NextResponse.json({ orgId: org.id, bookingAppKey });
}
