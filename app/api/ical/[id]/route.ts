import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadConfigFromDB } from "@/lib/loadConfig";
import type { InquiryFormData } from "@/lib/types";

function toIcalDate(date: string, time?: string): string {
  // date = "YYYY-MM-DD", time = "HH:MM" or undefined
  const d = date.replace(/-/g, "");
  if (time) {
    const t = time.replace(":", "") + "00";
    return `${d}T${t}`;
  }
  return d; // all-day
}

function escapeIcal(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    include: { client: true },
  });

  if (!inquiry) {
    return new NextResponse("Not found", { status: 404 });
  }

  let data: InquiryFormData;
  try {
    data = JSON.parse(inquiry.data) as InquiryFormData;
  } catch {
    return new NextResponse("Invalid data", { status: 500 });
  }

  const config = await loadConfigFromDB(inquiry.client.slug);
  const companyName = config.company.name;
  const location = config.company.address ?? "";

  const dtStart = toIcalDate(data.datumVon, data.zeitVon || undefined);
  const dtEnd   = toIcalDate(data.datumBis, data.zeitBis || undefined);
  const allDay  = !data.zeitVon && !data.zeitBis;
  const dtProp  = allDay ? "DATE" : "DATE-TIME";

  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//eventwulf//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${inquiry.id}@eventwulf`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=${dtProp}:${dtStart}`,
    `DTEND;VALUE=${dtProp}:${dtEnd}`,
    `SUMMARY:${escapeIcal(data.artTitel)}`,
    location ? `LOCATION:${escapeIcal(location)}` : "",
    `DESCRIPTION:${escapeIcal(`Gruppenleitung: ${data.nameGruppenleitung}\\nTeilnehmer: ${data.personenAnzahl}\\n${companyName}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="event-${id.slice(0, 8)}.ics"`,
    },
  });
}
