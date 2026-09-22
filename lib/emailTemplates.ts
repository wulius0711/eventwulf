import { escapeHtml } from "@/lib/validate";

// Pulled out of app/api/admin/team/route.ts and
// app/api/stripe/webhook/route.ts as their own pure functions so the
// HTML-escaping fix (Phase 6: org.name/session.email/companyName were
// interpolated raw into the HTML body — sanitizeEmailHeader() only strips
// \r\n\t for header-injection protection, it never escaped HTML) is
// unit-testable without a real Resend call, which fails outright in the
// test environment (RESEND_API_KEY is a fixed invalid value there).

export function inviteEmailHtml(inviterEmail: string, orgName: string, inviteUrl: string): string {
  const safeInviterEmail = escapeHtml(inviterEmail);
  const safeOrgName = escapeHtml(orgName);
  return `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:2rem">
          <h2 style="margin:0 0 0.5rem;font-size:1.2rem;color:#1a1612">Du wurdest zu eventwulf eingeladen</h2>
          <p style="margin:0 0 1.5rem;color:#6b7280;font-size:0.9rem">
            ${safeInviterEmail} hat dich zum Team von "${safeOrgName}" auf eventwulf eingeladen.
          </p>
          <p style="margin:0 0 1.5rem"><a href="${inviteUrl}" style="display:inline-block;padding:10px 20px;background:#996C1E;color:#ffffff;border-radius:8px;text-decoration:none;font-size:0.9rem;font-weight:600">Einladung annehmen</a></p>
          <p style="margin:0;color:#6b7280;font-size:0.8rem">Der Link ist 7 Tage gültig.</p>
        </div>
      `;
}

export function welcomeEmailHtml(companyName: string, inviteUrl: string): string {
  const safeCompanyName = escapeHtml(companyName);
  return `
            <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:2rem">
              <h2 style="margin:0 0 0.5rem;font-size:1.2rem;color:#1a1612">Willkommen bei eventwulf, ${safeCompanyName}!</h2>
              <p style="margin:0 0 1.5rem;color:#6b7280;font-size:0.9rem">
                Deine 14-tägige Testphase hat begonnen. Setze jetzt ein Passwort, um dich einzuloggen und loszulegen.
              </p>
              <p style="margin:0 0 1.5rem"><a href="${inviteUrl}" style="display:inline-block;padding:10px 20px;background:#996C1E;color:#ffffff;border-radius:8px;text-decoration:none;font-size:0.9rem;font-weight:600">Konto aktivieren</a></p>
              <p style="margin:0;color:#6b7280;font-size:0.8rem">Der Link ist 7 Tage gültig.</p>
            </div>
          `;
}
