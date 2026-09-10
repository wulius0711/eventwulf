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

export function isSafeCssColor(val: unknown): val is string {
  return typeof val === "string" && SAFE_CSS_COLOR_RE.test(val);
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

export function validatePassword(val: unknown): string | null {
  if (typeof val !== "string") return "Passwort muss ein String sein";
  if (val.length < 8) return "Passwort muss mindestens 8 Zeichen lang sein";
  if (val.length > 128) return "Passwort zu lang";
  return null;
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
  if (b.notifyEmail !== undefined && b.notifyEmail !== "" && !isValidEmail(b.notifyEmail)) return "notifyEmail ungültig";
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
