import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { loadConfigFromDB } from "@/lib/loadConfig";
import type { InquiryFormData } from "@/lib/types";

function fmt(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
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
      const accent = config.company.primaryColor ?? "#6366f1";

      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:2rem">
          <h2 style="margin:0 0 0.5rem;font-size:1.3rem;color:#1a1612">Erinnerung: Ihr Event morgen</h2>
          <p style="margin:0 0 1.5rem;color:#6b6256;font-size:0.9rem">
            Hallo ${data.nameGruppenleitung}, wir möchten Sie an Ihren bestätigten Termin erinnern.
          </p>
          <table style="border-collapse:collapse;width:100%;background:#f9f9f7;border-radius:8px;padding:1rem">
            <tr><td style="padding:6px 12px 6px 0;color:#6b6256;font-size:0.85rem;white-space:nowrap">Veranstaltung</td><td style="padding:6px 0;font-size:0.85rem;color:#1a1612;font-weight:600">${data.artTitel}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#6b6256;font-size:0.85rem;white-space:nowrap">Beginn</td><td style="padding:6px 0;font-size:0.85rem;color:#1a1612">${fmt(data.datumVon)}${data.zeitVon ? `, ${data.zeitVon} Uhr` : ""}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#6b6256;font-size:0.85rem;white-space:nowrap">Ende</td><td style="padding:6px 0;font-size:0.85rem;color:#1a1612">${fmt(data.datumBis)}${data.zeitBis ? `, ${data.zeitBis} Uhr` : ""}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#6b6256;font-size:0.85rem;white-space:nowrap">Teilnehmer</td><td style="padding:6px 0;font-size:0.85rem;color:#1a1612">${data.personenAnzahl}</td></tr>
          </table>
          <p style="margin-top:2rem;font-size:0.8rem;color:#6b6256">
            ${companyName}${config.company.address ? ` · ${config.company.address}` : ""}${config.company.phone ? ` · ${config.company.phone}` : ""}
          </p>
        </div>
      `;

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
