// Split layout shared by the password-reset pages (photo left, form right) —
// same look as the login and signup pages.
export default function AuthSplit({ headline, sub, children }: { headline: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="admin-shell ew-auth-dark ew-auth-wrap" style={{ display: "flex", minHeight: "100vh" }}>
      <div
        className="ew-auth-split-left"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          backgroundImage: "url(/auth-bg/1.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          padding: "2.5rem 3rem",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(14,21,37,0.72) 0%, rgba(21,110,71,0.22) 50%, rgba(14,21,37,0.85) 100%)",
          }}
        />
        <a href="https://eventwulf.at" aria-label="eventwulf – zur Startseite" style={{ position: "relative", alignSelf: "flex-start", display: "inline-block" }}>
          <img src="/eventwulf-logo.png" alt="eventwulf" style={{ display: "block", height: "28px", width: "auto", filter: "brightness(0) invert(1)" }} />
        </a>
        <div style={{ position: "relative" }}>
          <p style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", lineHeight: 1.3 }}>{headline}</p>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: "rgba(255,255,255,0.75)" }}>{sub}</p>
        </div>
      </div>

      <div
        className="ew-auth-split-right"
        style={{
          width: "480px",
          flexShrink: 0,
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2.5rem 2rem",
          overflowY: "auto",
        }}
      >
        <div style={{ width: "100%", maxWidth: "360px" }}>
          {/* Mobile only (the photo panel with the logo is hidden there) */}
          <a href="https://eventwulf.at" className="ew-auth-mobile-logo" aria-label="eventwulf – zur Startseite" style={{ display: "none", marginBottom: "1.25rem" }}>
            <img src="/eventwulf-logo.png" alt="eventwulf" style={{ display: "block", height: "24px", width: "auto", filter: "brightness(0) invert(1)" }} />
          </a>
          {children}
        </div>
      </div>
    </div>
  );
}
