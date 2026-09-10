import type { EventConfig, InvoiceLineItem } from "@/lib/types";
import { isValidHexColor } from "@/lib/validate";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/theme";

// This template is rendered straight to a `text/html` response (the actual
// offer page a customer opens/prints) — every dynamic value below is
// free-text (company name, notes, line item descriptions, etc.) and must be
// escaped, not interpolated raw, or a saved config/invoice value containing
// `<`/`"` could inject markup into a page shown to guests.
function escapeHtml(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface TemplateData {
  number: string;
  issuedAt: Date;
  validUntil?: Date | null;
  notes?: string;
  lineItems: InvoiceLineItem[];
  taxRate: number;
  config: EventConfig;
  recipientName: string;
  recipientEmail?: string;
  eventTitle?: string;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtCurrency(n: number): string {
  return n.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

export function renderInvoiceHtml(data: TemplateData): string {
  const { number, issuedAt, validUntil, notes, lineItems, taxRate, config, recipientName, recipientEmail, eventTitle } = data;

  const net = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const tax = net * taxRate;
  const gross = net + tax;
  const taxPct = Math.round(taxRate * 100);

  // primaryColor is a CSS value, not free text — validated against the same
  // hex format as everywhere else, not merely escaped (a non-hex string could
  // still be visually broken even if HTML-safe).
  const primaryColor = isValidHexColor(config.company.primaryColor) ? config.company.primaryColor : DEFAULT_PRIMARY_COLOR;

  // Everything else below is free text a customer could end up viewing on
  // this served HTML page — escaped, not interpolated raw.
  const companyName = escapeHtml(config.company.name);
  const tagline = escapeHtml(config.company.tagline);
  const address = escapeHtml(config.company.address);
  const phone = escapeHtml(config.company.phone);
  const email = escapeHtml(config.company.email);
  const safeNumber = escapeHtml(number);
  const safeEventTitle = escapeHtml(eventTitle);
  const safeRecipientName = escapeHtml(recipientName);
  const safeRecipientEmail = escapeHtml(recipientEmail);
  const safeNotes = escapeHtml(notes);

  const rows = lineItems.map((item) => {
    const total = item.quantity * item.unitPrice;
    return `
      <tr>
        <td style="padding:0.6rem 0.75rem;border-bottom:1px solid #e5e7eb;font-size:0.875rem">${escapeHtml(item.description)}</td>
        <td style="padding:0.6rem 0.75rem;border-bottom:1px solid #e5e7eb;font-size:0.875rem;text-align:center">${item.quantity}</td>
        <td style="padding:0.6rem 0.75rem;border-bottom:1px solid #e5e7eb;font-size:0.875rem;text-align:right">${fmtCurrency(item.unitPrice)}</td>
        <td style="padding:0.6rem 0.75rem;border-bottom:1px solid #e5e7eb;font-size:0.875rem;text-align:right;font-weight:500">${fmtCurrency(total)}</td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Angebot ${safeNumber}</title>
<style>
  @media print {
    body { margin: 0; }
    .no-print { display: none !important; }
  }
  body { font-family: system-ui, -apple-system, sans-serif; color: #111827; margin: 0; background: #fff; }
  .page { max-width: 780px; margin: 0 auto; padding: 3rem 2.5rem; }
</style>
</head>
<body>
<div class="page">

  <!-- Print button -->
  <div class="no-print" style="margin-bottom:1.5rem;text-align:right">
    <button onclick="window.print()" style="padding:0.5rem 1.25rem;background:${primaryColor};color:#fff;border:none;border-radius:6px;font-size:0.875rem;cursor:pointer;font-weight:600">
      Drucken / PDF
    </button>
  </div>

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2.5rem">
    <div>
      <div style="font-size:1.4rem;font-weight:700;color:${primaryColor}">${companyName}</div>
      ${tagline ? `<div style="font-size:0.85rem;color:#6b7280;margin-top:0.2rem">${tagline}</div>` : ""}
    </div>
    <div style="text-align:right;font-size:0.8rem;color:#6b7280;line-height:1.6">
      ${address ? `<div>${address}</div>` : ""}
      ${phone ? `<div>${phone}</div>` : ""}
      ${email ? `<div>${email}</div>` : ""}
    </div>
  </div>

  <hr style="border:none;border-top:2px solid ${primaryColor};margin-bottom:2rem"/>

  <!-- Document info -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2rem">
    <div>
      <div style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem">Angebot</div>
      <div style="font-size:0.875rem;color:#374151;line-height:1.8">
        <div><strong>Angebot-Nr.:</strong> ${safeNumber}</div>
        <div><strong>Datum:</strong> ${fmtDate(issuedAt)}</div>
        ${validUntil ? `<div><strong>Gültig bis:</strong> ${fmtDate(validUntil)}</div>` : ""}
        ${safeEventTitle ? `<div><strong>Betreff:</strong> ${safeEventTitle}</div>` : ""}
      </div>
    </div>
    <div style="font-size:0.875rem;color:#374151;line-height:1.8;text-align:right">
      <div style="font-size:0.75rem;color:#9ca3af;margin-bottom:0.25rem">An:</div>
      <div style="font-weight:600">${safeRecipientName}</div>
      ${safeRecipientEmail ? `<div style="color:#6b7280">${safeRecipientEmail}</div>` : ""}
    </div>
  </div>

  <!-- Line items -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem">
    <thead>
      <tr style="background:${primaryColor};color:#fff">
        <th style="padding:0.6rem 0.75rem;text-align:left;font-size:0.8rem;font-weight:600">Leistung</th>
        <th style="padding:0.6rem 0.75rem;text-align:center;font-size:0.8rem;font-weight:600;width:80px">Menge</th>
        <th style="padding:0.6rem 0.75rem;text-align:right;font-size:0.8rem;font-weight:600;width:110px">Einzelpreis</th>
        <th style="padding:0.6rem 0.75rem;text-align:right;font-size:0.8rem;font-weight:600;width:110px">Gesamt</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:1.5rem">
    <table style="font-size:0.875rem;min-width:240px">
      <tr>
        <td style="padding:0.3rem 0.75rem;color:#6b7280">Nettobetrag</td>
        <td style="padding:0.3rem 0.75rem;text-align:right">${fmtCurrency(net)}</td>
      </tr>
      <tr>
        <td style="padding:0.3rem 0.75rem;color:#6b7280">MwSt. ${taxPct}%</td>
        <td style="padding:0.3rem 0.75rem;text-align:right">${fmtCurrency(tax)}</td>
      </tr>
      <tr style="border-top:2px solid #111827;font-weight:700">
        <td style="padding:0.5rem 0.75rem">Gesamtbetrag</td>
        <td style="padding:0.5rem 0.75rem;text-align:right;font-size:1rem;color:${primaryColor}">${fmtCurrency(gross)}</td>
      </tr>
    </table>
  </div>

  ${safeNotes ? `<div style="margin-bottom:1.5rem;padding:1rem 1.25rem;background:#f9fafb;border-radius:6px;font-size:0.85rem;color:#374151;white-space:pre-line">${safeNotes}</div>` : ""}

  <p style="margin-top:2rem;font-size:0.78rem;color:#9ca3af">Dies ist ein unverbindliches Angebot. Preise verstehen sich zzgl. ${taxPct}% MwSt.</p>

  <div style="margin-top:3rem;padding-top:1rem;border-top:1px solid #e5e7eb;font-size:0.75rem;color:#9ca3af;text-align:center">
    ${companyName}${address ? ` · ${address}` : ""}${email ? ` · ${email}` : ""}
  </div>
</div>
</body>
</html>`;
}
