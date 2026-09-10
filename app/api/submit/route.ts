import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { randomBytes } from "crypto";
import { loadConfigFromDB } from "@/lib/loadConfig";
import { prisma } from "@/lib/db";
import type { InquiryFormData } from "@/lib/types";
import { rateLimit, getIp } from "@/lib/ratelimit";
import { validateSubmit } from "@/lib/validate";
import { reserveEventCapacity, HOLD_DURATION_MS, CapacityExceededError } from "@/lib/eventCapacity";
import { assertRoomAvailable, RoomConflictError } from "@/lib/roomAvailability";

function sanitize(val: unknown): string {
  return String(val ?? "").replace(/[\r\n\t]/g, " ").trim();
}

function yesNo(val: boolean | null) {
  if (val === true) return "Ja";
  if (val === false) return "Nein";
  return "–";
}

function row(label: string, value: string) {
  if (!value || value === "–") return "";
  return `<tr><td style="padding:6px 12px 6px 0;color:#6b6256;font-size:0.85rem;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0;font-size:0.85rem;color:#1a1612">${value}</td></tr>`;
}

function fmt(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`submit:${getIp(req)}`, 5, 10 * 60 * 1000)) {
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
  // Resolved once, up front, so eventId/roomId below are always looked up scoped to
  // this client — otherwise a submission to Client A's public form could reference
  // Client B's Event/Room by id (both are just public, enumerable cuids).
  const client = await prisma.client.findUnique({ where: { slug } });

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
  if (body.roomId) {
    const room = client ? await prisma.room.findFirst({ where: { id: body.roomId, clientId: client.id } }) : null;
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
  }

  const notifyEmail = config.notifyEmail ?? process.env.NOTIFY_EMAIL ?? "";

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

  const operatorHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:2rem">
      <h2 style="margin:0 0 1.5rem;font-size:1.3rem;color:#1a1612">
        Neue Anfrage – ${body.artTitel || "Retreat"}
      </h2>
      <table style="border-collapse:collapse;width:100%">
        ${rows}
      </table>
      <p style="margin-top:2rem;font-size:0.8rem;color:#6b6256">
        Gesendet über ${config.company.name}
      </p>
    </div>
  `;

  const confirmationHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:2rem">
      <h2 style="margin:0 0 0.5rem;font-size:1.3rem;color:#1a1612">Ihre Anfrage ist eingegangen</h2>
      <p style="margin:0 0 1.5rem;color:#6b6256;font-size:0.9rem">
        Vielen Dank, ${body.nameGruppenleitung}! Wir haben Ihre Anfrage erhalten und melden uns in Kürze.
      </p>
      <table style="border-collapse:collapse;width:100%">
        ${rows}
      </table>
      <p style="margin-top:2rem;font-size:0.8rem;color:#6b6256">
        ${config.company.name}${config.company.tagline ? ` – ${config.company.tagline}` : ""}<br/>
        ${[config.company.address, config.company.phone, config.company.email, config.company.website].filter(Boolean).join(" · ")}
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
        if (body.roomId) {
          await assertRoomAvailable(tx, body.roomId, body.datumVon, body.datumBis);
        }
        return tx.inquiry.create({
          data: {
            clientId: client.id,
            data: JSON.stringify(body),
            status: "neu",
            participantCount,
            cancelToken,
            ...(body.eventId ? { eventId: body.eventId } : {}),
            ...(body.roomId ? { roomId: body.roomId } : {}),
            // An unanswered booking hold expires 48h after submission — for either
            // an Event (capacity release) or a Room (see /api/cron/room-holds).
            ...(body.eventId || body.roomId ? { holdExpiresAt: new Date(Date.now() + HOLD_DURATION_MS) } : {}),
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
    console.error("Failed to save inquiry:", e);
    // Guard: emails must not be sent if the inquiry was not persisted
    return NextResponse.json({ error: "Anfrage konnte nicht gespeichert werden" }, { status: 500 });
  }

  const host = req.headers.get("host") ?? "";
  const proto = host.startsWith("localhost") ? "http" : "https";

  const icalLink = inquiryId
    ? `<p style="margin-top:1.5rem;display:flex;gap:10px;flex-wrap:wrap"><a href="${proto}://${host}/api/ical/${inquiryId}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-size:0.875rem;font-weight:600">📅 Zum Kalender hinzufügen</a>${savedCancelToken ? `<a href="${proto}://${host}/api/cancel/${savedCancelToken}" style="display:inline-block;padding:10px 20px;background:transparent;color:#6b7280;border:1px solid #e5e7eb;border-radius:8px;text-decoration:none;font-size:0.875rem;font-weight:600">Anfrage stornieren</a>` : ""}</p>`
    : "";

  const confirmationHtmlWithIcal = confirmationHtml.replace(
    "</div>",
    `${icalLink}</div>`
  );

  // The inquiry is already saved at this point — email delivery is a side effect,
  // not part of the guest-facing success criteria. A failure here must be logged,
  // not turned into a 500, or the guest would retry and create a duplicate inquiry.
  const resend = new Resend(process.env.RESEND_API_KEY);

  // The operator notification is the one email that must not silently vanish
  // (it's how the retreat actually learns about the inquiry), so a single
  // transient failure gets one retry before being logged as missed.
  const sendOperatorEmail = resend.emails
    .send({
      from: `${config.company.name} <onboarding@resend.dev>`,
      to: notifyEmail,
      replyTo: body.email ? sanitize(body.email) : undefined,
      subject: `Neue Anfrage: ${sanitize(body.artTitel) || "Retreat"} – ${sanitize(body.nameGruppenleitung)}`,
      html: operatorHtml,
    })
    .then(({ error }) => {
      if (error) throw error;
    })
    .catch(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { error } = await resend.emails.send({
        from: `${config.company.name} <onboarding@resend.dev>`,
        to: notifyEmail,
        replyTo: body.email ? sanitize(body.email) : undefined,
        subject: `Neue Anfrage: ${sanitize(body.artTitel) || "Retreat"} – ${sanitize(body.nameGruppenleitung)}`,
        html: operatorHtml,
      });
      if (error) throw error;
    })
    .catch((e) => {
      console.error(`Failed to send operator notification email for inquiry ${inquiryId} (after retry):`, e);
    });

  const sendConfirmationEmail = body.email
    ? resend.emails
        .send({
          from: `${config.company.name} <onboarding@resend.dev>`,
          to: body.email,
          subject: `Anfrage erhalten – ${sanitize(body.artTitel) || "Retreat"}`,
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
