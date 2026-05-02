const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidEmail(val: unknown): val is string {
  return typeof val === "string" && EMAIL_RE.test(val) && val.length <= 254;
}

export function isValidDate(val: unknown): val is string {
  return typeof val === "string" && DATE_RE.test(val);
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
  if (b.formTitle !== undefined && str(b.formTitle, 200) === null) return "formTitle zu lang";
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
  if (b.email && !isValidEmail(b.email)) return "E-Mail-Adresse ungültig";
  if (b.packageId !== undefined && b.packageId !== "" && (typeof b.packageId !== "string" || b.packageId.length > 50)) {
    return "packageId ungültig";
  }
  const textFields: [string, number][] = [
    ["personenAnzahl", 20], ["leiterinnen", 20], ["zeitVon", 10], ["zeitBis", 10],
    ["sonstigesEquipment", 500], ["verpflegung", 200], ["zimmerwunsch", 200],
    ["wuenscheRahmenprogramm", 1000], ["abrechnung", 200], ["telefon", 50],
    ["sprache", 50], ["anreise", 200], ["barrierefreiheit", 500], ["budget", 100], ["quelle", 200],
  ];
  for (const [field, max] of textFields) {
    if (b[field] !== undefined && str(b[field], max) === null) return `${field} zu lang`;
  }
  return null;
}
