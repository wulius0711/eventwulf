import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { Resend } from "resend";
import { randomBytes } from "crypto";
import { loadConfigFromDB } from "@/lib/loadConfig";
import { prisma } from "@/lib/db";
import type { InquiryFormData } from "@/lib/types";
import { rateLimit, getIp } from "@/lib/ratelimit";
import { validateSubmit, escapeHtml, sanitizeEmailHeader, findMissingRequiredField } from "@/lib/validate";
import { reserveEventCapacity, HOLD_DURATION_MS, CapacityExceededError } from "@/lib/eventCapacity";
import { assertRoomAvailable, RoomConflictError } from "@/lib/roomAvailability";
import { hasFeature, effectivePlan } from "@/lib/plan";

// Exported for direct testing — VERCEL_URL is only actually set on Vercel,
// so this can't be exercised end-to-end against the local test server; the
// choice of source (env vars vs. request header) is what's under test, not
// anything HTTP-observable.
//
// appUrl (NEXT_PUBLIC_APP_URL) takes priority over vercelUrl: VERCEL_URL is
// documented by Vercel to always be the deployment's auto-generated
// *.vercel.app alias, never a custom domain attached to the project — so on
// a production deploy with app.eventwulf.at attached, VERCEL_URL alone would
// still put the wrong (vercel.app) domain into every emailed link. appUrl is
// only ever set from a server-controlled env var (Vercel project settings),
// same trust level as vercelUrl, so this doesn't reopen the Host-header
// spoofing gap the VERCEL_URL fix closed. Left unset for preview deploys and
// local dev, where vercelUrl/headerHost are the correct fallbacks.
export function resolveBaseUrl(
  appUrl: string | undefined,
  vercelUrl: string | undefined,
  headerHost: string
): { host: string; proto: string } {
  if (appUrl) {
    const url = new URL(appUrl);
    return { host: url.host, proto: url.protocol.replace(":", "") };
  }
  const host = vercelUrl ?? headerHost;
  const proto = vercelUrl ? "https" : host.startsWith("localhost") ? "http" : "https";
  return { host, proto };
}

function yesNo(val: boolean | null) {
  if (val === true) return "Ja";
  if (val === false) return "Nein";
  return "–";
}

// value is whatever the guest submitted (or a DB-looked-up event/room name)
// interpolated straight into an HTML email — escaped here once, for every
// call site, rather than at each of the ~20 calls below (label is always a
// hardcoded string literal, never needs escaping). Exported so the escaping
// can be verified directly against the actual rendered markup — the emails
// this builds never come back as an HTTP response body to assert on.
export function row(label: string, value: string) {
  if (!value || value === "–") return "";
  return `<tr><td style="padding:6px 12px 6px 0;color:#6b6256;font-size:0.85rem;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0;font-size:0.85rem;color:#1a1612">${escapeHtml(value)}</td></tr>`;
}

function fmt(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(`submit:${getIp(req)}`, 5, 10 * 60 * 1000))) {
    return NextResponse.json({ error: "Zu viele Anfragen. Bitte warte 10 Minuten." }, { status: 429 });
  }

  const raw = await req.json();
  const validationError = validateSubmit(raw);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }
  const body = raw as InquiryFormData & { slug?: string };
  const slug = body.slug ?? "default";
  const config = await loadConfigFromDB(slug);

  // Event bookings come from the separate EventsList widget, which only ever
  // collects name/email/participant count — none of the requirable fields
  // below exist in that flow, so the check would otherwise block every
  // event booking as soon as a client has any field marked required.
  if (!body.eventId) {
    const missingRequired = findMissingRequiredField(config, body);
    if (missingRequired) {
      return NextResponse.json({ error: `Bitte „${missingRequired.label}" ausfüllen.` }, { status: 400 });
    }
  }

  // Resolved once, up front, so eventId/roomId below are always looked up scoped to
  // this client — otherwise a submission to Client A's public form could reference
  // Client B's Event/Room by id (both are just public, enumerable cuids).
  const client = await prisma.client.findUnique({
    where: { slug },
    include: { organization: { select: { plan: true, subscriptionStatus: true, disputeLostAt: true } } },
  });

  // Demo clients are for the marketing-site widget preview — the frontend already
  // intercepts submit before calling this route, but reject here too in case
  // someone bypasses the UI and posts directly.
  if (client?.isDemo) {
    return NextResponse.json({ error: "Das ist nur eine Demo — hier wird nichts versendet." }, { status: 403 });
  }

  // Rooms are a Pro+ feature — same gate as the public read path
  // (app/api/rooms/route.ts), which already hides rooms from a downgraded
  // org's picker. That's a read-side gate only, though: this write path
  // never re-checked it, so a roomId submitted directly (bypassing the
  // picker/UI entirely) was still silently accepted and booked regardless
  // of the org's current plan. Clamped once, right here, before any of the
  // four separate places below that use it (validation, the availability
  // check, the Inquiry insert, and the hold-expiry flag) — rather than
  // re-checking hasFeature() in each of them separately and risking one
  // getting missed in a future change (see the getOrgPlan()/
  // requireRoomsAccess() duplication finding for the same class of risk).
  // When the feature is locked, this silently ignores a submitted roomId —
  // exactly as if none had been sent — which is correct for the actual
  // security case (a direct API call bypassing the UI, which needs no
  // feedback), but is an imperfect experience for the rare edge case of a
  // legitimate guest whose already-open page had a room selected right as
  // the org's plan lapsed underneath them: their booking silently saves
  // without the room, with nothing telling them their choice was dropped.
  // Not fixed here — low-frequency, no security impact — but worth knowing
  // if a "my room booking disappeared" report ever comes in.
  // client?.organizationId guards this: a Client with no Organization at
  // all has no plan/billing to gate against, so the check is skipped
  // entirely rather than falling back to effectivePlan()'s "no org" ->
  // basis default (which would lock rooms for a case this gate was never
  // meant to cover). This relies on an invariant that holds today but is
  // nowhere enforced by the schema (Client.organizationId is nullable):
  // every real Client is created together with its Organization — the only
  // Client-creation call site in the app is
  // app/api/admin/orgs/[id]/clients/route.ts, always nested under an
  // existing org. If a future Client-creation path is ever added without
  // one, this gate would silently never apply to it — whoever adds that
  // path needs to either give it an organizationId too, or revisit this
  // check. See the maintainability backlog for the same class of
  // undocumented-but-relied-on assumption (live-key env inheritance,
  // test-only flags).
  const roomsUnlocked = !client?.organizationId || hasFeature(effectivePlan(client.organization), "rooms");
  const roomId = roomsUnlocked ? body.roomId : undefined;

// Resolve event, validate participant count and reserve capacity if an eventId was submitted.
  let eventName = "";
  // validateSubmit already guarantees this is a positive integer within bounds.
  const participantCount = Number(body.personenAnzahl);
  if (body.eventId) {
    const event = client ? await prisma.event.findFirst({ where: { id: body.eventId, clientId: client.id } }) : null;
    if (!event || !event.isActive) {
      return NextResponse.json({ error: "Dieses Event ist nicht mehr verfügbar" }, { status: 400 });
    }
    if (participantCount < event.minParticipants) {
      return NextResponse.json({ error: `Mindestens ${event.minParticipants} Teilnehmer:innen erforderlich` }, { status: 400 });
    }
    if (event.maxParticipants !== null && participantCount > event.maxParticipants) {
      return NextResponse.json({ error: `Maximal ${event.maxParticipants} Teilnehmer:innen möglich` }, { status: 400 });
    }
    // The actual capacity reservation happens inside the save transaction below,
    // atomically with the Inquiry insert (see lib/eventCapacity.ts) — reserving it
    // here, separately, would let a crash between the two leak booked capacity.
    eventName = event.name;
  }

  // Resolve the room (if selected) so the display name comes from the DB, not client input.
  let roomName = "";
  if (roomId) {
    const room = client ? await prisma.room.findFirst({ where: { id: roomId, clientId: client.id } }) : null;
    if (!room || !room.isActive) {
      return NextResponse.json({ error: "Dieser Raum ist nicht mehr verfügbar" }, { status: 400 });
    }
    // Plain read, no transaction needed — capacity doesn't change between
    // requests in a way that would create a race (unlike availability/booking).
    if (room.capacity != null && participantCount > room.capacity) {
      return NextResponse.json(
        { error: `„${room.name}" bietet Platz für bis zu ${room.capacity} Personen — die eingegebene Teilnehmerzahl liegt darüber.` },
        { status: 400 }
      );
    }
    roomName = room.name;
  } else if (roomsUnlocked && client && !body.eventId && config.formFields?.raum !== false) {
    // Mirrors the RoomPicker's own visibility condition (rooms.length > 0) —
    // if the guest was shown a room picker, a room must actually be chosen,
    // otherwise the inquiry bypasses the double-booking protection entirely
    // (assertRoomAvailable/capacity-hold below only run when roomId is set).
    // Skipped for event bookings (body.eventId set): those come from the
    // separate EventsList flow, which has no room picker at all — a room
    // there, if any, is the event's own (Event.roomId), not the guest's pick.
    // Also skipped when rooms aren't unlocked at all — same reasoning as
    // roomId itself above: no feature means no picker was ever shown, so
    // there's nothing to have required a choice from.
    const activeRoomCount = await prisma.room.count({ where: { clientId: client.id, isActive: true } });
    if (activeRoomCount > 0) {
      return NextResponse.json({ error: "Bitte einen Raum auswählen." }, { status: 400 });
    }
  }

  const notifyEmail = config.notifyEmail ?? "";

  if (!notifyEmail) {
    return NextResponse.json({ error: "Kein Empfänger konfiguriert" }, { status: 500 });
  }

  const rows = [
    row("Event", eventName),
    row("Raum", roomName),
    row("Art / Titel", body.artTitel),
    row("Gruppenleitung", body.nameGruppenleitung),
    row("E-Mail", body.email),
    row("Beginn", body.datumVon && body.zeitVon ? `${fmt(body.datumVon)}, ${body.zeitVon} Uhr` : fmt(body.datumVon)),
    row("Ende", body.datumBis && body.zeitBis ? `${fmt(body.datumBis)}, ${body.zeitBis} Uhr` : fmt(body.datumBis)),
    row("Teilnehmer:innen", body.personenAnzahl),
    row("Leiter:innen", body.leiterinnen),
    row("Bestuhlung", yesNo(body.bestuhlung)),
    row("Tische", yesNo(body.tische)),
    row("Beamer / Projektor", yesNo(body.beamer)),
    row("Soundanlage / Mikrofon", yesNo(body.soundanlage)),
    row("Außenbereich", yesNo(body.aussenbereich)),
    row("Equipment", body.sonstigesEquipment),
    row("Verpflegung", body.verpflegung),
    row("Zimmerwunsch", body.zimmerwunsch),
    row("Rahmenprogramm", body.wuenscheRahmenprogramm),
    row("Abrechnung", body.abrechnung),
    row("Telefon", body.telefon),
    row("Sprache", body.sprache),
    row("Anreise", body.anreise),
    row("Besondere Bedürfnisse", body.barrierefreiheit),
    row("Budgetrahmen", body.budget),
    row("Wie gefunden", body.quelle),
  ].filter(Boolean).join("\n");

  // Guest-submitted (artTitel, nameGruppenleitung) and admin-configured
  // (company.*) values alike — escaped regardless of source, same as the
  // row() values above and the invoiceTemplate.ts precedent this reuses
  // escapeHtml from.
  const safeArtTitel = escapeHtml(body.artTitel);
  const safeGruppenleitung = escapeHtml(body.nameGruppenleitung);
  const safeCompanyName = escapeHtml(config.company.name);
  const safeTagline = escapeHtml(config.company.tagline);
  const safeAddress = escapeHtml(config.company.address);
  const safePhone = escapeHtml(config.company.phone);
  const safeCompanyEmail = escapeHtml(config.company.email);
  const safeWebsite = escapeHtml(config.company.website);

  const operatorHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:2rem">
      <h2 style="margin:0 0 1.5rem;font-size:1.3rem;color:#1a1612">
        Neue Anfrage – ${safeArtTitel || "Retreat"}
      </h2>
      <table style="border-collapse:collapse;width:100%">
        ${rows}
      </table>
      <p style="margin-top:2rem;font-size:0.8rem;color:#6b6256">
        Gesendet über ${safeCompanyName}
      </p>
    </div>
  `;

  const confirmationHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:2rem">
      <h2 style="margin:0 0 0.5rem;font-size:1.3rem;color:#1a1612">Ihre Anfrage ist eingegangen</h2>
      <p style="margin:0 0 1.5rem;color:#6b6256;font-size:0.9rem">
        Vielen Dank, ${safeGruppenleitung}! Wir haben Ihre Anfrage erhalten und melden uns in Kürze.
      </p>
      <table style="border-collapse:collapse;width:100%">
        ${rows}
      </table>
      <p style="margin-top:2rem;font-size:0.8rem;color:#6b6256">
        ${safeCompanyName}${safeTagline ? ` – ${safeTagline}` : ""}<br/>
        ${[safeAddress, safePhone, safeCompanyEmail, safeWebsite].filter(Boolean).join(" · ")}
      </p>
    </div>
  `;

  // Save inquiry first to get the ID and cancelToken for the email links
  let inquiryId: string | null = null;
  let savedCancelToken: string | null = null;
  try {
    if (client) {
      const cancelToken = randomBytes(24).toString("hex");
      const inquiry = await prisma.$transaction(async (tx) => {
        // Capacity reservation, the room overlap check, and the insert must all
        // happen inside the same locked transaction: a crash between the capacity
        // update and the insert would otherwise leak booked capacity with no
        // corresponding inquiry (Fund 3), and two near-simultaneous submissions
        // for the same room could both pass the overlap check before either has
        // actually inserted.
        if (body.eventId) {
          const reserved = await reserveEventCapacity(body.eventId, participantCount, tx);
          if (!reserved) throw new CapacityExceededError();
        }
        if (roomId) {
          await assertRoomAvailable(tx, roomId, body.datumVon, body.datumBis);
        }
        return tx.inquiry.create({
          data: {
            clientId: client.id,
            data: JSON.stringify(body),
            status: "neu",
            participantCount,
            cancelToken,
            ...(body.eventId ? { eventId: body.eventId } : {}),
            ...(roomId ? { roomId } : {}),
            // An unanswered booking hold expires 48h after submission — for either
            // an Event (capacity release) or a Room (see /api/cron/room-holds).
            ...(body.eventId || roomId ? { holdExpiresAt: new Date(Date.now() + HOLD_DURATION_MS) } : {}),
          },
        });
      });
      inquiryId = inquiry.id;
      savedCancelToken = cancelToken;
    }
  } catch (e) {
    if (e instanceof CapacityExceededError) {
      return NextResponse.json({ error: "Nicht mehr genügend Plätze für dieses Event verfügbar" }, { status: 400 });
    }
    if (e instanceof RoomConflictError) {
      return NextResponse.json({ error: "Dieser Raum ist im gewählten Zeitraum leider bereits belegt" }, { status: 409 });
    }
    // The room (or event) passed its pre-check above but was deleted by an
    // admin before this transaction's insert ran — Inquiry.roomId/eventId's
    // FK constraint rejects the now-stale id. Narrow to this specific code so
    // any other, unrelated DB error still falls through to the generic 500
    // below instead of being misreported as "room/event gone".
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json({ error: "Dieser Raum oder dieses Event ist inzwischen leider nicht mehr verfügbar" }, { status: 409 });
    }
    console.error("Failed to save inquiry:", e);
    // Guard: emails must not be sent if the inquiry was not persisted
    return NextResponse.json({ error: "Anfrage konnte nicht gespeichert werden" }, { status: 500 });
  }

  // NEXT_PUBLIC_APP_URL (the real production custom domain) if set, else
  // VERCEL_URL (the deployment's own *.vercel.app alias — never a custom
  // domain, but a safe fallback on preview deploys) instead of the request's
  // Host header, which Vercel documents as reflecting whatever the client
  // sent, not something it validates against the deployment's real domain
  // (https://vercel.com/docs/headers/request-headers#host). A crafted Host
  // header would otherwise flow straight into these email links' href
  // attributes. Neither env var is set locally, so local dev still falls
  // back to the request header (harmless there — there's no untrusted
  // client to spoof it against).
  const { host, proto } = resolveBaseUrl(process.env.NEXT_PUBLIC_APP_URL, process.env.VERCEL_URL, req.headers.get("host") ?? "");

  const icalLink = inquiryId
    ? `<p style="margin-top:1.5rem;display:flex;gap:10px;flex-wrap:wrap"><a href="${proto}://${host}/api/ical/${inquiryId}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-size:0.875rem;font-weight:600">📅 Zum Kalender hinzufügen</a>${savedCancelToken ? `<a href="${proto}://${host}/api/cancel/${savedCancelToken}" style="display:inline-block;padding:10px 20px;background:transparent;color:#6b7280;border:1px solid #e5e7eb;border-radius:8px;text-decoration:none;font-size:0.875rem;font-weight:600">Anfrage stornieren</a>` : ""}</p>`
    : "";

  const confirmationHtmlWithIcal = confirmationHtml.replace(
    "</div>",
    `${icalLink}</div>`
  );

  const adminLink = `<p style="margin-top:1.5rem"><a href="${proto}://${host}/admin/inquiries" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-size:0.875rem;font-weight:600">Anfrage im Admin ansehen</a></p>`;
  const operatorHtmlWithLink = operatorHtml.replace("</div>", `${adminLink}</div>`);

  // The inquiry is already saved at this point — email delivery is a side effect,
  // not part of the guest-facing success criteria. A failure here must be logged,
  // not turned into a 500, or the guest would retry and create a duplicate inquiry.
  const resend = new Resend(process.env.RESEND_API_KEY);

  // The operator notification is the one email that must not silently vanish
  // (it's how the retreat actually learns about the inquiry), so a single
  // transient failure gets one retry before being logged as missed.
  const sendOperatorEmail = resend.emails
    .send({
      from: `${sanitizeEmailHeader(config.company.name)} <anfrage@eventwulf.at>`,
      to: notifyEmail,
      replyTo: body.email ? sanitizeEmailHeader(body.email) : undefined,
      subject: `Neue Anfrage: ${sanitizeEmailHeader(body.artTitel) || "Retreat"} – ${sanitizeEmailHeader(body.nameGruppenleitung)}`,
      html: operatorHtmlWithLink,
    })
    .then(({ error }) => {
      if (error) throw error;
    })
    .catch(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { error } = await resend.emails.send({
        from: `${sanitizeEmailHeader(config.company.name)} <anfrage@eventwulf.at>`,
        to: notifyEmail,
        replyTo: body.email ? sanitizeEmailHeader(body.email) : undefined,
        subject: `Neue Anfrage: ${sanitizeEmailHeader(body.artTitel) || "Retreat"} – ${sanitizeEmailHeader(body.nameGruppenleitung)}`,
        html: operatorHtmlWithLink,
      });
      if (error) throw error;
    })
    .catch((e) => {
      console.error(`Failed to send operator notification email for inquiry ${inquiryId} (after retry):`, e);
    });

  const sendConfirmationEmail = body.email
    ? resend.emails
        .send({
          from: `${sanitizeEmailHeader(config.company.name)} <anfrage@eventwulf.at>`,
          to: body.email,
          replyTo: notifyEmail,
          subject: `Anfrage erhalten – ${sanitizeEmailHeader(body.artTitel) || "Retreat"}`,
          html: confirmationHtmlWithIcal,
        })
        .then(({ error }) => {
          if (error) throw error;
        })
        .catch((e) => {
          console.error(`Failed to send guest confirmation email for inquiry ${inquiryId}:`, e);
        })
    : Promise.resolve();

  await Promise.all([sendOperatorEmail, sendConfirmationEmail]);

  return NextResponse.json({ ok: true });
}
