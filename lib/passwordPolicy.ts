import { createHash } from "crypto";

// One place for every "set a new password" check (invite, reset, account,
// superadmin-created clients):
//  1. length 8..128
//  2. not trivially guessable (offline: obvious words/patterns, ignoring
//     trailing digits and symbols, so "Sommer2024!" is caught too)
//  3. not in a known data breach (Have I Been Pwned "range" API: only the first
//     5 characters of the SHA-1 hash leave the server, never the password).
//     If that service is slow or down the check is skipped, so nobody gets
//     locked out of setting a password.

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;
const HIBP_TIMEOUT_MS = 2500;

// Compared after lower-casing and stripping trailing digits/symbols.
const BASE_WORDS = new Set([
  "password", "passwort", "passw0rd", "p@ssw0rd", "p@ssword", "pa$$word", "passwd",
  "qwerty", "qwertz", "qwertyui", "qwertyuiop", "qwertzui", "qwertzuiop", "asdfghjk", "asdfghjkl",
  "asdfasdf", "asdfgh", "zxcvbnm", "yxcvbnm", "abcdefgh", "abcdefghi", "abcdefghij", "abcabcabc",
  "iloveyou", "ichliebedich", "letmein", "welcome", "willkommen", "hallo", "hallowelt", "halloween",
  "hello", "helloworld", "sommer", "winter", "fruehling", "frühling", "herbst", "sonnenschein", "sunshine",
  "admin", "administrator", "adminadmin", "root", "changeme", "geheim", "secret", "master", "default",
  "login", "test", "testtest", "testing", "tester", "user", "benutzer", "guest",
  "monkey", "dragon", "football", "fussball", "baseball", "superman", "batman", "princess", "shadow",
  "trustno", "schatz", "schatzi", "mustermann", "musterfrau", "musterfirma", "computer", "internet",
  "eventwulf", "cateringwulf", "bookingwulf", "hungrywulf", "wulf", "wulius",
]);

// Whole-password matches that don't fit the "word + trailing digits" shape.
const COMMON_EXACT = new Set([
  "1q2w3e4r", "1q2w3e4r5t", "q1w2e3r4", "q1w2e3r4t5", "1qaz2wsx", "zaq12wsx", "qazwsxedc",
  "abc12345", "abcd1234", "a1b2c3d4", "asd12345", "aa123456", "qwe12345", "iloveyou1", "trustno1",
]);

function isTooGuessable(password: string): boolean {
  const lower = password.toLowerCase();
  if (/^(.)\1+$/.test(password)) return true; // "aaaaaaaa"
  if (/^\d+$/.test(password)) return true; // digits only: 12345678, 20240101 ...
  if (COMMON_EXACT.has(lower)) return true;
  const base = lower.replace(/[0-9!@#$%^&*()._\-+=?]+$/, "");
  return base === "" || BASE_WORDS.has(base);
}

async function isInDataBreach(password: string): Promise<boolean> {
  if (process.env.PASSWORD_BREACH_CHECK_DISABLED === "true") return false;
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  const baseUrl = process.env.HIBP_API_URL ?? "https://api.pwnedpasswords.com";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/range/${prefix}`, {
      headers: { "Add-Padding": "true" }, // pads the answer so its size doesn't hint at the result
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [hashSuffix, count] = line.trim().split(":");
      if (hashSuffix === suffix && Number(count) > 0) return true; // padding rows have count 0
    }
    return false;
  } catch {
    return false; // service unreachable or too slow: don't block the user
  } finally {
    clearTimeout(timer);
  }
}

// Returns an error message for the user, or null if the password is fine.
export async function validateNewPassword(password: unknown): Promise<string | null> {
  if (typeof password !== "string") return "Passwort muss ein String sein";
  if (password.length < MIN_LENGTH) return `Passwort muss mindestens ${MIN_LENGTH} Zeichen lang sein`;
  if (password.length > MAX_LENGTH) return "Passwort zu lang";
  if (isTooGuessable(password)) return "Dieses Passwort ist zu leicht zu erraten. Bitte wähle ein anderes.";
  if (await isInDataBreach(password)) return "Dieses Passwort ist aus Datenlecks bekannt. Bitte wähle ein anderes.";
  return null;
}
