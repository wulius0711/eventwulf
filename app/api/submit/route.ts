import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { loadConfigFromDB } from "@/lib/loadConfig";
import { prisma } from "@/lib/db";
import type { InquiryFormData } from "@/lib/types";

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
  const body = await req.json() as InquiryFormData & { slug?: string };
  const slug = body.slug ?? "default";
  const config = await loadConfigFromDB(slug);
  const notifyEmail = config.notifyEmail ?? process.env.NOTIFY_EMAIL ?? "";

  if (!notifyEmail) {
    return NextResponse.json({ error: "Kein Empfänger konfiguriert" }, { status: 500 });
  }

  const rows = [
    row("Art / Titel", body.artTitel),
    row("Gruppenleitung", body.nameGruppenleitung),
    row("E-Mail", body.email),
    row("Beginn", body.datumVon && body.zeitVon ? `${fmt(body.datumVon)}, ${body.zeitVon} Uhr` : fmt(body.datumVon)),
    row("Ende", body.datumBis && body.zeitBis ? `${fmt(body.datumBis)}, ${body.zeitBis} Uhr` : fmt(body.datumBis)),
    row("Teilnehmer:innen", body.personenAnzahl),
    row("Leiter:innen", body.leiterinnen),
    row("Bestuhlung", yesNo(body.bestuhlung)),
    row("Tische", yesNo(body.tische)),
    row("Equipment", body.sonstigesEquipment),
    row("Verpflegung", body.verpflegung),
    row("Zimmerwunsch", body.zimmerwunsch),
    row("Rahmenprogramm", body.wuenscheRahmenprogramm),
    row("Abrechnung", body.abrechnung),
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

  const resend = new Resend(process.env.RESEND_API_KEY);

  const [operatorResult, confirmResult] = await Promise.all([
    resend.emails.send({
      from: `${config.company.name} <noreply@resend.dev>`,
      to: notifyEmail,
      replyTo: body.email || undefined,
      subject: `Neue Anfrage: ${body.artTitel || "Retreat"} – ${body.nameGruppenleitung}`,
      html: operatorHtml,
    }),
    body.email
      ? resend.emails.send({
          from: `${config.company.name} <noreply@resend.dev>`,
          to: body.email,
          subject: `Anfrage bestätigt – ${body.artTitel || "Retreat"}`,
          html: confirmationHtml,
        })
      : Promise.resolve({ error: null }),
  ]);

  if (operatorResult.error) {
    console.error("Resend operator error:", operatorResult.error);
    return NextResponse.json({ error: "E-Mail konnte nicht gesendet werden" }, { status: 500 });
  }
  if (confirmResult.error) {
    console.error("Resend confirmation error:", confirmResult.error);
  }

  // Save inquiry to DB (best-effort)
  try {
    const client = await prisma.client.findUnique({ where: { slug } });
    if (client) {
      await prisma.inquiry.create({
        data: {
          clientId: client.id,
          data: JSON.stringify(body),
          status: "neu",
        },
      });
    }
  } catch (e) {
    console.error("Failed to save inquiry:", e);
  }

  return NextResponse.json({ ok: true });
}
