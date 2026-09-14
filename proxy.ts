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

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host !== "eventwulf.at" && host !== "www.eventwulf.at") {
    return NextResponse.next();
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

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const config = {
  matcher: "/:path*",
};
