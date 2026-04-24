import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { loadConfigFromDB } from "@/lib/loadConfig";
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
    row("Gruppengröße", body.gruppengroesse),
    row("Datum", body.datum),
    row("E-Mail", body.email),
    row("Beginn & Ende", body.veranstaltungBeginnEnde),
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

  const html = `
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

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: `${config.company.name} <noreply@resend.dev>`,
    to: notifyEmail,
    replyTo: body.email || undefined,
    subject: `Neue Anfrage: ${body.artTitel || "Retreat"} – ${body.nameGruppenleitung}`,
    html,
  });

  if (error) {
    console.error("Resend error:", error);
    return NextResponse.json({ error: "E-Mail konnte nicht gesendet werden" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
