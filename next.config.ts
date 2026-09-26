import type { NextConfig } from "next";

// React uses eval() in development only, to reconstruct server-side error
// stacks in the browser — neither React nor Next.js use it in production
// (confirmed: no eval()/new Function() anywhere in this project either).
// See https://nextjs.org/docs/app/guides/content-security-policy.
const isDev = process.env.NODE_ENV === "development";
const scriptSrc = `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`;

const commonHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

// Widget route – embeddable from any origin
const widgetHeaders = [
  ...commonHeaders,
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://eventwulf-zone.b-cdn.net",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "frame-ancestors *",
    ].join("; "),
  },
];

// Everything except the widget pages and /api/submit — no embedding allowed.
// (Used to be admin-only; audit 2026-09-26, M3: /signup, /signup/complete,
// /storniert and the /login redirect had no headers at all.)
const lockedDownHeaders = [
  ...commonHeaders,
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://eventwulf-zone.b-cdn.net",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const submitHeaders = [
  ...commonHeaders,
  { key: "Access-Control-Allow-Origin", value: "*" },
  { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
  { key: "Access-Control-Allow-Headers", value: "Content-Type" },
];

const nextConfig: NextConfig = {
  // sharp ships native binaries per platform — must be traced as a true external
  // package so its .node/.so files are copied into the deployed function output
  // instead of getting dropped by the bundler.
  serverExternalPackages: ["sharp"],
  // Dev-only indicator badge, default bottom-left — overlaps the admin
  // sidebar's own bottom-left controls (theme toggle). Never renders in
  // production, purely a local-dev convenience move.
  devIndicators: { position: "top-right" },
  async headers() {
    // Keeps this app's own CSP/security headers off the proxied Framer
    // content (see proxy.ts) — Framer's fonts/scripts/images would
    // otherwise violate a policy written for this app's own pages.
    const notEventwulfAt = [
      { type: "host" as const, value: "eventwulf.at" },
      { type: "host" as const, value: "www.eventwulf.at" },
    ];

    return [
      // The two embeddable widget pages and the CORS-enabled submit endpoint keep
      // their own rules ...
      { source: "/",               headers: widgetHeaders, missing: notEventwulfAt },
      { source: "/events",         headers: widgetHeaders, missing: notEventwulfAt },
      { source: "/api/submit",     headers: submitHeaders, missing: notEventwulfAt },
      // ... and EVERY other path gets the lock-down. The rules must not overlap:
      // Next.js merges ALL matching header rules for a path instead of letting the
      // first one win (that is how /api/submit once inherited the admin CSP and
      // X-Frame-Options on top of its own). "/" is excluded by `.+` (needs at
      // least one character), the other two by the negative lookahead.
      { source: "/((?!events$|api/submit$).+)", headers: lockedDownHeaders, missing: notEventwulfAt },
    ];
  },
};

export default nextConfig;
