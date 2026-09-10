import type { NextConfig } from "next";

// React uses eval() in development only, to reconstruct server-side error
// stacks in the browser — neither React nor Next.js use it in production
// (confirmed: no eval()/new Function() anywhere in this project either).
// See https://nextjs.org/docs/app/guides/content-security-policy.
const isDev = process.env.NODE_ENV === "development";
const scriptSrc = `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`;

const commonHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
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

// Admin routes – no embedding allowed
const adminHeaders = [
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
  async headers() {
    return [
      { source: "/",               headers: widgetHeaders },
      { source: "/events",         headers: widgetHeaders },
      { source: "/admin/(.*)",     headers: adminHeaders },
      { source: "/api/submit",     headers: submitHeaders },
      // Excludes /api/submit — Next.js merges ALL matching header rules for a
      // path rather than letting the first/more-specific one win, so without
      // this exclusion /api/submit silently also inherited adminHeaders'
      // X-Frame-Options and admin Content-Security-Policy on top of its own
      // (Low/Info: redundant headers).
      { source: "/api/((?!submit).*)", headers: adminHeaders },
    ];
  },
};

export default nextConfig;
