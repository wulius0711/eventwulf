import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nextInvoiceNumber } from "@/lib/invoiceNumber";
import { renderInvoiceHtml } from "@/lib/invoiceTemplate";
import { loadConfigFromDB } from "@/lib/loadConfig";
import type { InvoiceLineItem, InquiryFormData } from "@/lib/types";
import { Resend } from "resend";
import { isHeld, reserveEventCapacity, CapacityExceededError } from "@/lib/eventCapacity";
import { ConflictError } from "@/lib/concurrency";
import { validateInvoiceLineItems } from "@/lib/validate";

function serialize(inv: {
  id: string; inquiryId: string; number: string; status: string;
  lineItems: string; taxRate: number; validUntil: Date | null;
  notes: string; sentAt: Date | null; issuedAt: Date;
}) {
  return {
    id: inv.id,
    inquiryId: inv.inquiryId,
    number: inv.number,
    status: inv.status,
    lineItems: JSON.parse(inv.lineItems) as InvoiceLineItem[],
    taxRate: inv.taxRate,
    validUntil: inv.validUntil?.toISOString() ?? null,
    notes: inv.notes,
    sentAt: inv.sentAt?.toISOString() ?? null,
    issuedAt: inv.issuedAt.toISOString(),
  };
}

async function getClientId(slug: string) {
  const client = await prisma.client.findUnique({ where: { slug }, select: { id: true } });
  return client?.id ?? null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const clientId = await getClientId(session.clientSlug);
  if (!clientId) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });

  const invoices = await prisma.invoice.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invoices.map(serialize));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const clientId = await getClientId(session.clientSlug);
  if (!clientId) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });

  const body = await req.json() as {
    inquiryId: string;
    updatedAt?: string;
    lineItems: InvoiceLineItem[];
    taxRate?: number;
    validUntil?: string;
    notes?: string;
    sendEmail?: boolean;
  };

  if (!body.inquiryId) {
    return NextResponse.json({ error: "Ungültige Parameter" }, { status: 400 });
  }
  const lineItemsError = validateInvoiceLineItems(body.lineItems);
  if (lineItemsError) {
    return NextResponse.json({ error: lineItemsError }, { status: 400 });
  }
  if (!body.updatedAt) {
    return NextResponse.json({ error: "updatedAt fehlt" }, { status: 400 });
  }

  const inquiry = await prisma.inquiry.findFirst({ where: { id: body.inquiryId, clientId } });
  if (!inquiry) return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 });

  const config = await loadConfigFromDB(session.clientSlug);
  const taxRate = body.taxRate ?? config.billing?.taxRate ?? 0.20;
  const number = await nextInvoiceNumber(clientId);

  const validityDays = config.billing?.validityDays ?? 30;
  const defaultValidUntil = new Date();
  defaultValidUntil.setDate(defaultValidUntil.getDate() + validityDays);

  let invoice;
  let inquiryUpdatedAt: Date;
  try {
    ({ invoice, inquiryUpdatedAt } = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          clientId,
          inquiryId: body.inquiryId,
          type: "angebot",
          number,
          lineItems: JSON.stringify(body.lineItems),
          taxRate,
          validUntil: body.validUntil ? new Date(body.validUntil) : defaultValidUntil,
          notes: body.notes ?? "",
          sentAt: body.sendEmail ? new Date() : null,
        },
      });

      // Same optimistic-concurrency guard as the PATCH handler in
      // admin/inquiries (Fund 5) — this is a second, independent place that
      // writes Inquiry.status and needs the same protection.
      const result = await tx.inquiry.updateMany({
        where: { id: body.inquiryId, clientId, updatedAt: new Date(body.updatedAt!) },
        data: { status: "angebot_versendet" },
      });
      if (result.count === 0) throw new ConflictError();

      // "angebot_versendet" is itself a held status. Creating an offer for an
      // inquiry that wasn't already held (e.g. previously rejected or expired)
      // must reserve capacity for it, or the event's bookedCount silently
      // undercounts what's actually held — reachable with a single click, no
      // concurrency needed, since the UI never blocks creating an offer based
      // on the inquiry's current status.
      if (inquiry.eventId && inquiry.participantCount > 0 && !isHeld(inquiry.status)) {
        const reserved = await reserveEventCapacity(inquiry.eventId, inquiry.participantCount, tx);
        if (!reserved) throw new CapacityExceededError();
      }

      const updatedInquiry = await tx.inquiry.findUniqueOrThrow({ where: { id: body.inquiryId } });
      return { invoice: created, inquiryUpdatedAt: updatedInquiry.updatedAt };
    }));
  } catch (e) {
    if (e instanceof ConflictError) {
      return NextResponse.json(
        { error: "Diese Anfrage wurde inzwischen von jemand anderem geändert — bitte neu laden." },
        { status: 409 }
      );
    }
    if (e instanceof CapacityExceededError) {
      return NextResponse.json({ error: "Für diesen Status reicht die freie Kapazität des Events nicht mehr aus" }, { status: 400 });
    }
    throw e;
  }

  // Send email if requested
  if (body.sendEmail) {
    try {
      const inquiryData = JSON.parse(inquiry.data) as InquiryFormData;
      const recipientEmail = inquiryData.email;
      if (recipientEmail) {
        const html = renderInvoiceHtml({
          number,
          issuedAt: invoice.issuedAt,
          validUntil: invoice.validUntil,
          notes: invoice.notes,
          lineItems: body.lineItems,
          taxRate,
          config,
          recipientName: inquiryData.nameGruppenleitung,
          recipientEmail,
          eventTitle: inquiryData.artTitel,
        });
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: `${config.company.name} <noreply@resend.dev>`,
          to: recipientEmail,
          subject: `Angebot ${number} – ${config.company.name}`,
          html,
        });
      }
    } catch (e) {
      console.error("Invoice email send failed:", e);
    }
  }

  return NextResponse.json({ ...serialize(invoice), inquiryUpdatedAt: inquiryUpdatedAt.toISOString() });
}
