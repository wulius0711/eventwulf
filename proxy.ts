import { NextRequest, NextResponse } from "next/server";

// eventwulf.at (root domain) is the Framer marketing site, not this app —
// Framer's own custom-domain connection needs a paid plan, so this proxies
// the bare domain straight through to the framer.website deployment
// server-side. A declarative next.config.ts rewrite to an external URL
// preserves the original Host header, which made Framer's edge reject the
// request ("Site Not Found") since it doesn't recognize eventwulf.at as a
// connected domain — this explicit fetch() sets Host to framer.website
// instead, which Framer accepts. app.eventwulf.at (and every other host)
// falls through to this app's normal routing untouched.
const FRAMER_HOST = "eventwulf.framer.website";

const LLMS_TXT = `# eventwulf

> eventwulf ist die Verwaltungssoftware für Eventlocations, Seminarhäuser und Hotels in Österreich und dem DACH-Raum: Buchungswidget, Kalender, Raum- und Eventverwaltung sowie automatische Angebote – alles an einem Ort.

## Funktionen
- Buchungswidget & Kalender: Echtzeitverfügbarkeit direkt in die Website eingebettet
- Individuelles Formular: Fragen ein-/ausblenden, Ausstattungsoptionen und Design anpassbar
- Räumeverwaltung: mehrere Räume mit Kapazität und Verfügbarkeit (ab Pro)
- Eigene Events: separat buchbare Termine mit Preis und Kapazität
- Automatische Angebote: aus Anfragen direkt Angebote erstellen und versenden
- Dokumenten-Archiv, Team-Mitglieder, Sperrzeiten, Live-Vorschau

## Preise
- Basis: 29 €/Monat (312 €/Jahr) – Buchungswidget & Kalender, bis zu 3 aktive Events
- Pro: 59 €/Monat (636 €/Jahr) – zusätzlich Räumeverwaltung, unbegrenzte Events, bis zu 2 Team-Mitglieder
- Premium: Preis auf Anfrage – unbegrenzte Räume, mehrere Standorte, unbegrenztes Team

## Zielgruppe
Cafés, Eventlocations, Catering-Betriebe und Hotels in Österreich und dem DACH-Raum.

## Links
- [Website](https://eventwulf.at)
- [Preise](https://eventwulf.at/#preise)
- [FAQ](https://eventwulf.at/#faq)
- [Kontakt](https://eventwulf.at/contact)
`;

// Content types where Framer's markup embeds its own framer.website domain
// (canonical link, og:url, sitemap <loc> entries, robots.txt's Sitemap:
// directive) — rewritten to the real host below. Framer has no idea
// eventwulf.at exists (see comment above), so it always self-references the
// free subdomain; everything else (images, fonts, JS, CSS) streams through
// untouched, unrewritten, for performance.
const REWRITABLE_CONTENT_TYPES = ["text/html", "text/xml", "application/xml", "text/plain"];

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  // No Content-Security-Policy here — this response is Framer's own markup,
  // referencing Framer's own script/font/image CDN origins that aren't
  // enumerated anywhere in this codebase; a CSP written blind would risk
  // breaking the live marketing site rather than hardening it.
};

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host !== "eventwulf.at" && host !== "www.eventwulf.at") {
    return NextResponse.next();
  }

  // Canonicalize on the apex domain — www and apex previously served
  // byte-identical proxied content as two indexable origins.
  if (host === "www.eventwulf.at") {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, "https://eventwulf.at");
    return NextResponse.redirect(target, 301);
  }

  // Framer has no file upload for a root-level text file, so llms.txt is
  // served directly here instead of proxied.
  if (request.nextUrl.pathname === "/llms.txt") {
    return new NextResponse(LLMS_TXT, { headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const upstreamUrl = new URL(
    request.nextUrl.pathname + request.nextUrl.search,
    `https://${FRAMER_HOST}`
  );

  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.set("host", FRAMER_HOST);
  upstreamHeaders.delete("x-forwarded-host");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: upstreamHeaders,
    body: hasBody ? request.body : undefined,
    // @ts-expect-error - required by undici when streaming a request body
    duplex: hasBody ? "half" : undefined,
    redirect: "manual",
  });

  const responseHeaders = new Headers(upstream.headers);
  // fetch() transparently decompresses the response body, but upstream.headers
  // still carries the original Content-Encoding/Content-Length describing the
  // compressed bytes — forwarding those unchanged alongside the now-decoded
  // body makes the browser try to decompress already-plain content and fail
  // (silently renders a blank page). The platform re-applies its own
  // compression to the client as needed.
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  const location = responseHeaders.get("location");
  if (location?.includes(FRAMER_HOST)) {
    responseHeaders.set("location", location.replace(FRAMER_HOST, host));
  }
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    responseHeaders.set(key, value);
  }

  const contentType = responseHeaders.get("content-type") ?? "";
  const shouldRewrite = REWRITABLE_CONTENT_TYPES.some((t) => contentType.startsWith(t));
  if (!shouldRewrite) {
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  }

  const body = (await upstream.text()).replaceAll(FRAMER_HOST, host);
  return new NextResponse(body, { status: upstream.status, headers: responseHeaders });
}

export const config = {
  matcher: "/:path*",
};
