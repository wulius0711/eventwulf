"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const MAX_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 1500;

export default function SignupCompletePage() {
  return (
    <Suspense fallback={null}>
      <SignupCompleteInner />
    </Suspense>
  );
}

function SignupCompleteInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError("Keine Session gefunden.");
      return;
    }

    let cancelled = false;

    async function poll(attempt: number) {
      const res = await fetch(`/api/signup/finalize?session_id=${encodeURIComponent(sessionId!)}`);
      if (cancelled) return;

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setReady(true);
        return;
      }
      if (res.ok && data.pending && attempt < MAX_ATTEMPTS) {
        setTimeout(() => poll(attempt + 1), POLL_INTERVAL_MS);
        return;
      }

      setError(data.error ?? "Dein Konto wird noch eingerichtet — bitte lade die Seite in ein paar Sekunden neu.");
    }

    poll(0);
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div
      className="admin-shell ew-auth-dark"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
        gap: "1.5rem",
        justifyContent: "center",
        background: "radial-gradient(ellipse 90% 60% at 20% 0%, rgba(21,110,71,0.28) 0%, transparent 60%), var(--bg)",
        textAlign: "center",
      }}
    >
      <img src="/eventwulf-logo.png" alt="eventwulf" style={{ height: "32px", width: "auto", filter: "brightness(0) invert(1)" }} />
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          padding: "2.5rem 2rem",
        }}
      >
        {error ? (
          <>
            <h1 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Fast fertig
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{error}</p>
          </>
        ) : ready ? (
          <>
            <h1 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Fast geschafft — prüfe deine E-Mails
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              Wir haben dir eine E-Mail geschickt, mit der du dein Passwort setzt und dich einloggst.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Konto wird eingerichtet…
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              Einen Moment, wir richten deinen Zugang ein.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
