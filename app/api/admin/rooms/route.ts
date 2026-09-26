import { NextRequest, NextResponse } from "next/server";
import sanitizeHtml from "sanitize-html";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { releaseRoomImage } from "@/lib/bunny";
import { validateImageField } from "@/lib/validate";
import { hasFeature, effectivePlan, minPlanFor, roomLimitFor, PLAN_LABELS, PlanLimitExceededError, type Plan } from "@/lib/plan";
import { hasActiveSubscription } from "@/lib/stripe";

function sanitizeDescription(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "strong", "em", "ul", "ol", "li", "br", "a"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
  });
}

function serialize(r: {
  id: string; name: string; description: string; image: string;
  capacity: number | null; isActive: boolean; sortOrder: number;
}) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    image: r.image,
    capacity: r.capacity,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
  };
}

const LOCKED_MESSAGE = `Räume sind ab dem ${PLAN_LABELS[minPlanFor("rooms")]}-Paket verfügbar.`;

async function requireRoomsAccess(): Promise<
  { ok: true; clientId: string; clientSlug: string; plan: Plan; hasActiveSubscription: boolean } | { ok: false; status: number; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, status: 401, error: "Nicht eingeloggt" };

  const client = await prisma.client.findUnique({ where: { slug: session.clientSlug }, select: { id: true } });
  if (!client) return { ok: false, status: 404, error: "Client nicht gefunden" };

  const org = await prisma.organization.findUnique({ where: { id: session.organizationId }, select: { plan: true, subscriptionStatus: true, disputeLostAt: true, stripeSubscriptionId: true } });
  const plan = effectivePlan(org);
  if (!hasFeature(plan, "rooms")) return { ok: false, status: 403, error: LOCKED_MESSAGE };

  return { ok: true, clientId: client.id, clientSlug: session.clientSlug, plan, hasActiveSubscription: hasActiveSubscription(org ?? {}) };
}

export async function GET() {
  const access = await requireRoomsAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const rooms = await prisma.room.findMany({
    where: { clientId: access.clientId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  // limit alongside the list so the admin UI can show a heads-up when a plan
  // downgrade left more active rooms than the current plan allows (Medium
  // finding 6) — existing rooms are never touched by a downgrade, only new
  // creation is gated (see POST below), so this is purely informational.
  // plan is included too so the UI can show a "X of Y (<Plan>)" usage line,
  // and hasActiveSubscription so UpgradeButton (rendered here at the room
  // limit) knows whether to route to checkout or the billing portal — see
  // hasActiveSubscription() in lib/stripe.ts.
  return NextResponse.json({
    rooms: rooms.map(serialize),
    limit: roomLimitFor(access.plan),
    plan: access.plan,
    hasActiveSubscription: access.hasActiveSubscription,
  });
}

export async function POST(req: NextRequest) {
  const access = await requireRoomsAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await req.json();
  const { name, description, image, capacity, isActive, sortOrder } = body;

  const imageError = validateImageField(image, access.clientSlug);
  if (imageError) {
    return NextResponse.json({ error: imageError }, { status: 400 });
  }

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name fehlt" }, { status: 400 });
  }
  const cap = capacity === "" || capacity == null ? null : Number(capacity);
  if (cap !== null && (!Number.isFinite(cap) || cap < 1)) {
    return NextResponse.json({ error: "Kapazität ungültig" }, { status: 400 });
  }

  // Active rooms only (Medium finding 6) — a client over the limit after a
  // plan downgrade can bring themselves back into compliance by
  // deactivating excess rooms rather than being stuck indefinitely, since a
  // downgrade itself never deactivates anything automatically.
  const limit = roomLimitFor(access.plan);

  try {
    const room = await prisma.$transaction(async (tx) => {
      // Serializes concurrent creates/reactivations for this client so the
      // count+create below can't race with another one — same
      // pg_advisory_xact_lock pattern as assertRoomAvailable
      // (lib/roomAvailability.ts): a second concurrent call blocks until the
      // first transaction commits, so its new row is already visible by the
      // time the second one re-counts.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${access.clientId})::bigint)`;
      if (limit !== null) {
        const count = await tx.room.count({ where: { clientId: access.clientId, isActive: true } });
        if (count >= limit) throw new PlanLimitExceededError();
      }
      return tx.room.create({
        data: {
          clientId: access.clientId,
          name: name.trim(),
          description: description ? sanitizeDescription(description) : "",
          image: image ?? "",
          capacity: cap,
          isActive: isActive !== false,
          sortOrder: Number(sortOrder) || 0,
        },
      });
    });
    return NextResponse.json(serialize(room));
  } catch (e) {
    if (e instanceof PlanLimitExceededError) {
      return NextResponse.json({ error: `Maximal ${limit} Räume im ${PLAN_LABELS[access.plan]}-Paket. Für mehr Räume upgraden.` }, { status: 400 });
    }
    return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const access = await requireRoomsAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await req.json();
  const { id, name, description, image, capacity, isActive, sortOrder } = body;

  const imageError = validateImageField(image, access.clientSlug);
  if (imageError) {
    return NextResponse.json({ error: imageError }, { status: 400 });
  }

  const existing = await prisma.room.findFirst({ where: { id, clientId: access.clientId } });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const cap = capacity === undefined ? existing.capacity : (capacity === "" || capacity == null ? null : Number(capacity));
  if (cap !== null && (!Number.isFinite(cap) || cap < 1)) {
    return NextResponse.json({ error: "Kapazität ungültig" }, { status: 400 });
  }

  // Reactivating a deactivated room is the same effective action as creating
  // one (it increases the active count), so it needs the same plan-limit
  // check (and the same lock, for the same race-safety reason) as POST —
  // otherwise a client could bring themselves back under the limit by
  // deactivating rooms, then bypass the creation gate entirely by
  // reactivating others instead of actually creating a new one.
  const isReactivating = isActive === true && !existing.isActive;
  const limit = roomLimitFor(access.plan);
  const newImage = image ?? existing.image;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (isReactivating) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${access.clientId})::bigint)`;
        if (limit !== null) {
          const count = await tx.room.count({ where: { clientId: access.clientId, isActive: true } });
          if (count >= limit) throw new PlanLimitExceededError();
        }
      }
      return tx.room.update({
        where: { id },
        data: {
          name: name?.trim() ?? existing.name,
          description: description !== undefined ? sanitizeDescription(description) : existing.description,
          image: newImage,
          capacity: cap,
          isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
          sortOrder: sortOrder !== undefined ? Number(sortOrder) : existing.sortOrder,
        },
      });
    });
    if (existing.image && existing.image !== newImage) {
      await releaseRoomImage(existing.image, access.clientId, id);
    }
    return NextResponse.json(serialize(updated));
  } catch (e) {
    if (e instanceof PlanLimitExceededError) {
      return NextResponse.json({ error: `Maximal ${limit} Räume im ${PLAN_LABELS[access.plan]}-Paket. Für mehr Räume upgraden.` }, { status: 400 });
    }
    return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const access = await requireRoomsAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id, confirmed } = await req.json();
  const existing = await prisma.room.findFirst({ where: { id, clientId: access.clientId } });
  if (!existing) return NextResponse.json({ ok: true }); // already gone

  // Event.room has onDelete: SetNull — deleting the Room silently unassigns
  // it from any Event instead of failing, which would otherwise change that
  // Event's calendar-blocking behavior (an Event with a Room only blocks
  // that Room's calendar; without one, "intern" blocks the whole general
  // calendar again — see components/Calendar.tsx) with no visible trace.
  // Require an explicit confirmation once there's something to lose.
  if (!confirmed) {
    const eventCount = await prisma.event.count({ where: { roomId: id, isActive: true } });
    if (eventCount > 0) {
      return NextResponse.json({ requiresConfirmation: true, eventCount }, { status: 409 });
    }
  }

  await prisma.room.delete({ where: { id } });
  if (existing.image) {
    await releaseRoomImage(existing.image, access.clientId, id);
  }

  return NextResponse.json({ ok: true });
}
