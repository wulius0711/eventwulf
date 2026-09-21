import type { EventConfig, FormFields, InquiryFormData } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
// formBgColor is a general CSS color (e.g. "transparent", "rgba(0,0,0,.4)"),
// not restricted to hex like primaryColor — this allowlists characters that
// can't break out of the `<style>{`body { background: ${pageBg}; }`}</style>`
// template literal it's interpolated into (no `;`, `{`, `}`, `<`, `/`, etc.).
const SAFE_CSS_COLOR_RE = /^[a-zA-Z0-9#(),.%\s-]{1,100}$/;

export function isValidHexColor(val: unknown): val is string {
  return typeof val === "string" && HEX_COLOR_RE.test(val);
}

// Shared by every HTML template that interpolates free-text values (invoice
// page, reminder/confirmation/operator emails) — originally only lived in
// lib/invoiceTemplate.ts, moved here so it has one shared home instead of
// being reimplemented per template.
export function escapeHtml(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isSafeCssColor(val: unknown): val is string {
  return typeof val === "string" && SAFE_CSS_COLOR_RE.test(val);
}

// Strips CR/LF/tab so a value can't inject an extra header line into an
// email (header injection — e.g. a crafted value adding its own Bcc:) when
// interpolated into a subject/from/replyTo. Originally only lived in
// app/api/submit/route.ts and was only ever applied to subject/replyTo
// there, never to from — moved here so it has one shared home and can be
// consistently applied everywhere a header is built from a dynamic value.
export function sanitizeEmailHeader(val: unknown): string {
  return String(val ?? "").replace(/[\r\n\t]/g, " ").trim();
}

export function isValidEmail(val: unknown): val is string {
  return typeof val === "string" && EMAIL_RE.test(val) && val.length <= 254;
}

export function isValidDate(val: unknown): val is string {
  return typeof val === "string" && DATE_RE.test(val);
}

const MAX_PARTICIPANT_COUNT = 10000;

// Checked against the raw value on purpose, not a pre-parsed one — parseInt("1.5")
// silently truncates to 1, which would make a non-integer input pass unnoticed.
export function isValidParticipantCount(val: unknown): boolean {
  if (typeof val !== "string" && typeof val !== "number") return false;
  const n = Number(val);
  return Number.isInteger(n) && n > 0 && n <= MAX_PARTICIPANT_COUNT;
}

// Shared between Event create and edit (Medium finding 5, Durchgang 3 part 1)
// — create silently coerced non-positive/non-numeric input to 1 via
// `Number(x) || 1`, which missed negative values entirely; edit had no
// coercion or validation at all, writing 0, negative numbers, or even NaN
// straight to the DB. Both paths now reject invalid input explicitly instead
// of silently defaulting or writing garbage.
export function validateMinParticipants(min: number, max: number | null): string | null {
  if (!Number.isInteger(min) || min < 1) {
    return "Min. Teilnehmer muss eine positive ganze Zahl sein";
  }
  if (max !== null && min > max) {
    return "Min. Teilnehmer darf nicht über Max. Teilnehmer liegen";
  }
  return null;
}

// Line items are fully admin-editable free-form input (the participantCount
// value only pre-fills the create form client-side) — validated on whatever
// was actually submitted, not on an assumption about where quantity came from.
export function validateInvoiceLineItems(val: unknown): string | null {
  if (!Array.isArray(val) || val.length === 0) return "Mindestens eine Position erforderlich";
  for (const item of val) {
    if (!item || typeof item !== "object") return "Position ungültig";
    const i = item as Record<string, unknown>;
    if (!Number.isInteger(i.quantity) || (i.quantity as number) <= 0) {
      return "Menge muss eine positive ganze Zahl sein";
    }
    if (typeof i.unitPrice !== "number" || !Number.isFinite(i.unitPrice) || i.unitPrice < 0) {
      return "Preis darf nicht negativ sein";
    }
  }
  return null;
}

function todayIso(): string {
  return new Date().toISOString().substring(0, 10);
}

export function str(val: unknown, max: number): string | null {
  if (typeof val !== "string") return null;
  if (val.length > max) return null;
  return val;
}

export function isStringArray(val: unknown): val is string[] {
  return Array.isArray(val) && val.every((v) => typeof v === "string" && v.length <= 200);
}

export function validateConfig(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Ungültiges Format";
  const b = body as Record<string, unknown>;
  if (!b.company || typeof b.company !== "object" || Array.isArray(b.company)) return "company fehlt";
  const c = b.company as Record<string, unknown>;
  if (!str(c.name, 200)) return "company.name ungültig";
  if (c.primaryColor !== undefined && !isValidHexColor(c.primaryColor)) {
    return "company.primaryColor muss ein Hex-Farbwert sein (z.B. #6366f1)";
  }
  if (b.formTitle !== undefined && str(b.formTitle, 200) === null) return "formTitle zu lang";
  if (b.formBgColor !== undefined && b.formBgColor !== "" && !isSafeCssColor(b.formBgColor)) {
    return "formBgColor ungültig";
  }
  if (!isValidEmail(b.notifyEmail)) return "notifyEmail ungültig oder fehlt";
  for (const key of ["verpflegungOptions", "zimmerwunschOptions", "abrechnungOptions", "ausstattungOptions", "anreiseOptions", "zahlungOptions", "budgetOptions", "quelleOptions"] as const) {
    if (b[key] !== undefined && !isStringArray(b[key])) return `${key} muss ein String-Array sein`;
  }
  return null;
}

export function validateSubmit(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Ungültiges Format";
  const b = body as Record<string, unknown>;
  if (!str(b.artTitel, 200)) return "artTitel fehlt oder zu lang";
  if (!str(b.nameGruppenleitung, 100)) return "nameGruppenleitung fehlt oder zu lang";
  if (!isValidDate(b.datumVon)) return "datumVon ungültig";
  if (!isValidDate(b.datumBis)) return "datumBis ungültig";
  if (b.datumVon < todayIso()) return "datumVon darf nicht in der Vergangenheit liegen";
  if (b.email && !isValidEmail(b.email)) return "E-Mail-Adresse ungültig";
  if (b.eventId !== undefined && b.eventId !== "" && (typeof b.eventId !== "string" || b.eventId.length > 50)) {
    return "eventId ungültig";
  }
  if (b.roomId !== undefined && b.roomId !== "" && (typeof b.roomId !== "string" || b.roomId.length > 50)) {
    return "roomId ungültig";
  }
  if (!isValidParticipantCount(b.personenAnzahl)) {
    return "Teilnehmerzahl ungültig";
  }
  const textFields: [string, number][] = [
    ["leiterinnen", 20], ["zeitVon", 10], ["zeitBis", 10],
    ["sonstigesEquipment", 500], ["verpflegung", 200], ["zimmerwunsch", 200], ["raum", 200],
    ["wuenscheRahmenprogramm", 1000], ["abrechnung", 200], ["telefon", 50],
    ["sprache", 50], ["anreise", 200], ["barrierefreiheit", 500], ["budget", 100], ["quelle", 200],
  ];
  for (const [field, max] of textFields) {
    if (b[field] !== undefined && str(b[field], max) === null) return `${field} zu lang`;
  }
  return null;
}

interface RequirableField {
  dataKey: keyof InquiryFormData;
  formFieldKey: keyof FormFields;
  step: number;
  label: string;
  // Mirrors each step component's own render condition — a field an admin
  // marked "required" but that (e.g. via an emptied options list) wouldn't
  // actually be shown to the guest must never block submission.
  isShown: (config: EventConfig) => boolean;
}

export const REQUIRABLE_FIELDS: RequirableField[] = [
  { dataKey: "zeitVon", formFieldKey: "uhrzeiten", step: 1, label: "Veranstaltungsbeginn (Uhrzeit)", isShown: (c) => c.formFields?.uhrzeiten !== false },
  { dataKey: "zeitBis", formFieldKey: "uhrzeiten", step: 1, label: "Veranstaltungsende (Uhrzeit)", isShown: (c) => c.formFields?.uhrzeiten !== false },
  { dataKey: "leiterinnen", formFieldKey: "leiterinnen", step: 2, label: "Leiter:innen", isShown: (c) => c.formFields?.leiterinnen !== false },
  { dataKey: "telefon", formFieldKey: "telefon", step: 2, label: "Telefon", isShown: (c) => c.formFields?.telefon !== false },
  { dataKey: "sprache", formFieldKey: "sprache", step: 2, label: "Sprache der Gruppe", isShown: (c) => c.formFields?.sprache !== false },
  { dataKey: "sonstigesEquipment", formFieldKey: "sonstigesEquipment", step: 3, label: "Sonstiges Equipment", isShown: (c) => c.formFields?.sonstigesEquipment !== false },
  { dataKey: "verpflegung", formFieldKey: "verpflegung", step: 4, label: "Verpflegung", isShown: (c) => c.formFields?.verpflegung !== false && c.verpflegungOptions?.length > 0 },
  { dataKey: "zimmerwunsch", formFieldKey: "zimmerwunsch", step: 4, label: "Zimmerwunsch", isShown: (c) => c.formFields?.zimmerwunsch !== false && c.zimmerwunschOptions?.length > 0 },
  { dataKey: "wuenscheRahmenprogramm", formFieldKey: "wuenscheRahmenprogramm", step: 5, label: "Wünsche Rahmenprogramm", isShown: (c) => c.formFields?.wuenscheRahmenprogramm !== false },
  { dataKey: "abrechnung", formFieldKey: "abrechnung", step: 5, label: "Abrechnung", isShown: (c) => c.formFields?.abrechnung !== false && c.abrechnungOptions?.length > 0 },
  { dataKey: "zahlung", formFieldKey: "zahlung", step: 5, label: "Zahlung", isShown: (c) => c.formFields?.zahlung !== false && c.zahlungOptions?.length > 0 },
  { dataKey: "anreise", formFieldKey: "anreise", step: 5, label: "Anreise", isShown: (c) => c.formFields?.anreise !== false },
  { dataKey: "barrierefreiheit", formFieldKey: "barrierefreiheit", step: 5, label: "Besondere Bedürfnisse", isShown: (c) => c.formFields?.barrierefreiheit !== false },
  { dataKey: "budget", formFieldKey: "budget", step: 5, label: "Budgetrahmen", isShown: (c) => c.formFields?.budget !== false && c.budgetOptions?.length > 0 },
  { dataKey: "quelle", formFieldKey: "quelle", step: 5, label: "Wie habt ihr uns gefunden?", isShown: (c) => c.formFields?.quelle !== false && c.quelleOptions?.length > 0 },
];

// Shared by the wizard (per-step, client-side) and /api/submit (all fields,
// server-side) — one place defining which fields an admin can mark
// "required" actually enforces that. `step` narrows to one wizard step;
// omitted, every field is checked (the server's use case).
export function findMissingRequiredField(
  config: EventConfig,
  data: Partial<Record<keyof InquiryFormData, unknown>>,
  step?: number
): RequirableField | null {
  for (const field of REQUIRABLE_FIELDS) {
    if (step !== undefined && field.step !== step) continue;
    if (config.formFields?.[field.formFieldKey] !== "required") continue;
    if (!field.isShown(config)) continue;
    const val = data[field.dataKey];
    if (typeof val !== "string" || !val.trim()) return field;
  }
  return null;
}
