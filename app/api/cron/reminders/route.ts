import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { loadConfigFromDB } from "@/lib/loadConfig";
import type { InquiryFormData } from "@/lib/types";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { escapeHtml } from "@/lib/validate";

function fmt(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// Exported so the escaping can be verified directly against the actual
// rendered HTML, not just "the route didn't error" — emails never come back
// as an HTTP response body, unlike the served invoice page this reuses
// escapeHtml from, so this is the only way to test the real output.
export function renderReminderHtml(
  data: Pick<InquiryFormData, "nameGruppenleitung" | "artTitel" | "datumVon" | "datumBis" | "zeitVon" | "zeitBis" | "personenAnzahl">,
  config: { company: { name: string; address?: string; phone?: string } }
): string {
  // Every value below is either guest-submitted (nameGruppenleitung,
  // artTitel, zeitVon/zeitBis, personenAnzahl) or admin-configured
  // (companyName, address, phone) — escaped the same way regardless of
  // source, matching the invoiceTemplate.ts fix this reuses escapeHtml
  // from. fmt(...) output is left unescaped: it's built from datumVon/
  // datumBis, which validateSubmit already constrains to \d{4}-\d{2}-\d{2}
  // at submission time, so it can only ever contain digits and dots.
  const safeName = escapeHtml(data.nameGruppenleitung);
  const safeTitle = escapeHtml(data.artTitel);
  const safeZeitVon = escapeHtml(data.zeitVon);
  const safeZeitBis = escapeHtml(data.zeitBis);
  const safeParticipants = escapeHtml(data.personenAnzahl);
  const safeCompanyName = escapeHtml(config.company.name);
  const safeAddress = escapeHtml(config.company.address);
  const safePhone = escapeHtml(config.company.phone);

  return `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:2rem">
          <h2 style="margin:0 0 0.5rem;font-size:1.3rem;color:#1a1612">Erinnerung: Ihr Event morgen</h2>
          <p style="margin:0 0 1.5rem;color:#6b6256;font-size:0.9rem">
            Hallo ${safeName}, wir möchten Sie an Ihren bestätigten Termin erinnern.
          </p>
          <table style="border-collapse:collapse;width:100%;background:#f9f9f7;border-radius:8px;padding:1rem">
            <tr><td style="padding:6px 12px 6px 0;color:#6b6256;font-size:0.85rem;white-space:nowrap">Veranstaltung</td><td style="padding:6px 0;font-size:0.85rem;color:#1a1612;font-weight:600">${safeTitle}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#6b6256;font-size:0.85rem;white-space:nowrap">Beginn</td><td style="padding:6px 0;font-size:0.85rem;color:#1a1612">${fmt(data.datumVon)}${safeZeitVon ? `, ${safeZeitVon} Uhr` : ""}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#6b6256;font-size:0.85rem;white-space:nowrap">Ende</td><td style="padding:6px 0;font-size:0.85rem;color:#1a1612">${fmt(data.datumBis)}${safeZeitBis ? `, ${safeZeitBis} Uhr` : ""}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#6b6256;font-size:0.85rem;white-space:nowrap">Teilnehmer</td><td style="padding:6px 0;font-size:0.85rem;color:#1a1612">${safeParticipants}</td></tr>
          </table>
          <p style="margin-top:2rem;font-size:0.8rem;color:#6b6256">
            ${safeCompanyName}${safeAddress ? ` · ${safeAddress}` : ""}${safePhone ? ` · ${safePhone}` : ""}
          </p>
        </div>
      `;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  // Find all confirmed inquiries where datumVon is tomorrow and reminder not yet sent
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10); // "YYYY-MM-DD"

  const inquiries = await prisma.inquiry.findMany({
    where: {
      status: "bestaetigt",
      reminderSentAt: null,
    },
    include: { client: true },
  });

  const toRemind = inquiries.filter((inq) => {
    try {
      const data = JSON.parse(inq.data) as InquiryFormData;
      return data.datumVon === tomorrowStr && !!data.email;
    } catch {
      return false;
    }
  });

  let sent = 0;
  const errors: string[] = [];

  for (const inq of toRemind) {
    try {
      const data = JSON.parse(inq.data) as InquiryFormData;
      const config = await loadConfigFromDB(inq.client.slug);
      const companyName = config.company.name;

      const html = renderReminderHtml(data, config);

      await resend.emails.send({
        from: `${companyName} <noreply@resend.dev>`,
        to: data.email,
        subject: `Erinnerung: ${data.artTitel} morgen – ${companyName}`,
        html,
      });

      await prisma.inquiry.update({
        where: { id: inq.id },
        data: { reminderSentAt: new Date() },
      });

      sent++;
    } catch (e) {
      errors.push(`${inq.id}: ${e}`);
    }
  }

  return NextResponse.json({ sent, errors });
}
