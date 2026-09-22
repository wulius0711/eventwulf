import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateConfig } from "@/lib/validate";
import { effectivePlan, hasFeature } from "@/lib/plan";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const client = await prisma.client.findUnique({ where: { slug: session.clientSlug } });
  if (!client) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });

  return NextResponse.json(JSON.parse(client.config));
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  const configError = validateConfig(body);
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 400 });
  }

  // formFields.raum is a Pro+ feature (see FormularEditor's "proOnly"
  // gating) — the UI disables the checkbox once locked but never clears its
  // value, so a config saved before a downgrade (or a direct API call that
  // bypasses the UI entirely) could otherwise persist raum:true for a Basis
  // org. Silently normalize it instead of rejecting the whole save, which
  // would also block saving unrelated fields (e.g. company name) for any
  // org carrying this leftover state from before a downgrade. Harmless
  // no-op in practice today — the actual room picker independently checks
  // hasFeature() via the room list itself (see app/page.tsx) — but this is
  // the only thing that would still protect a future formFields-gated
  // feature that isn't backed by its own independent data-level check.
  if (body.formFields) {
    const org = await prisma.organization.findUnique({ where: { id: session.organizationId }, select: { plan: true, subscriptionStatus: true } });
    // Only actually rewrite (and log) when the incoming value would have
    // been effectively "enabled" — Wizard/RoomPicker treat anything other
    // than a literal `false` as enabled, so this only fires when there's a
    // real value to normalize, not on every save from an org that already
    // has raum:false or never set it. The log has no security purpose (the
    // downstream room list is independently gated regardless) — it's just
    // so we notice if/how often an org actually carries this leftover state
    // from before a downgrade; if it never fires, that's a good sign.
    if (body.formFields.raum !== false && !hasFeature(effectivePlan(org), "rooms")) {
      console.warn(`[config] Normalized formFields.raum to false for client "${session.clientSlug}" — plan doesn't include "rooms" (was ${JSON.stringify(body.formFields.raum)})`);
      body.formFields = { ...body.formFields, raum: false };
    }
  }

  await prisma.client.update({
    where: { slug: session.clientSlug },
    data: { config: JSON.stringify(body) },
  });

  // Echo back the (possibly normalized) config so the client updates its
  // own state to match what was actually persisted, instead of trusting
  // what it sent — otherwise the UI would show a stale, pre-normalization
  // value until the next full reload.
  return NextResponse.json({ ok: true, config: body });
}
