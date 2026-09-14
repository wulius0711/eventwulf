"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [error, setError] = useState("");

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
        router.push("/admin/config?welcome=1");
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
  }, [sessionId, router]);

  return (
    <div
      className="admin-shell"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
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
