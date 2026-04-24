"use client";
import { useState } from "react";
import { useFormStore, TOTAL_STEPS } from "@/store/form";
import type { YogaConfig } from "@/lib/types";
import Step1Veranstaltung from "@/components/steps/Step1Veranstaltung";
import Step2Gruppe from "@/components/steps/Step2Gruppe";
import Step3Ausstattung from "@/components/steps/Step3Ausstattung";
import Step4Verpflegung from "@/components/steps/Step4Verpflegung";
import Step5Abschluss from "@/components/steps/Step5Abschluss";

const STEP_LABELS = ["Veranstaltung", "Gruppe", "Ausstattung", "Verpflegung", "Abschluss"];

interface Props {
  config: YogaConfig;
  slug: string;
}

type SubmitState = "idle" | "loading" | "success" | "error";

function validate(step: number, form: import("@/lib/types").InquiryFormData): string {
  if (step === 1 && !form.artTitel.trim()) return "Bitte Veranstaltungstitel eingeben.";
  if (step === 2 && !form.nameGruppenleitung.trim()) return "Bitte Name der Gruppenleitung eingeben.";
  if (step === 2 && !form.email.trim()) return "Bitte E-Mail-Adresse eingeben.";
  return "";
}

export default function Wizard({ config, slug }: Props) {
  const { form, step, nextStep, prevStep, reset } = useFormStore();
  const [error, setError] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  function handleNext() {
    const err = validate(step, form);
    if (err) { setError(err); return; }
    setError("");
    nextStep();
  }

  async function handleSubmit() {
    setSubmitState("loading");
    setError("");
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, slug }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Senden");
      }
      setSubmitState("success");
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSubmitState("error");
    }
  }

  if (submitState === "success") {
    return (
      <div style={{ textAlign: "center", padding: "3rem 2rem" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✓</div>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Anfrage gesendet!
        </h2>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
          Vielen Dank! Wir melden uns so bald wie möglich bei dir.
        </p>
        <button
          onClick={() => setSubmitState("idle")}
          style={{
            padding: "0.65rem 1.75rem",
            background: "var(--primary)",
            color: "var(--btn-text)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Neue Anfrage
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "2.5rem" }}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <div key={n} style={{ display: "flex", alignItems: "center", flex: n < TOTAL_STEPS ? 1 : undefined }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}>
                <div
                  style={{
                    width: "2rem",
                    height: "2rem",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    background: done ? "var(--primary)" : active ? "var(--primary)" : "var(--bg2)",
                    color: done || active ? "var(--btn-text)" : "var(--muted)",
                    border: `2px solid ${active || done ? "var(--primary)" : "var(--border)"}`,
                    transition: "all 0.2s",
                  }}
                >
                  {done ? "✓" : n}
                </div>
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: active ? "var(--primary)" : "var(--muted)",
                    fontWeight: active ? 600 : 400,
                    whiteSpace: "nowrap",
                  }}
                >
                  {STEP_LABELS[i]}
                </span>
              </div>
              {n < TOTAL_STEPS && (
                <div
                  style={{
                    flex: 1,
                    height: "2px",
                    background: done ? "var(--primary)" : "var(--border)",
                    margin: "0 0.25rem",
                    marginBottom: "1.2rem",
                    transition: "background 0.2s",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step title */}
      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1.5rem" }}>
        {STEP_LABELS[step - 1]}
      </h2>

      {/* Step content */}
      <div style={{ minHeight: "200px" }}>
        {step === 1 && <Step1Veranstaltung slug={slug} />}
        {step === 2 && <Step2Gruppe config={config} />}
        {step === 3 && <Step3Ausstattung />}
        {step === 4 && <Step4Verpflegung config={config} />}
        {step === 5 && <Step5Abschluss config={config} />}
      </div>

      {/* Error */}
      {error && (
        <p style={{ color: "#dc2626", fontSize: "0.85rem", marginTop: "1rem" }}>{error}</p>
      )}

      {/* Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "2rem",
          paddingTop: "1.25rem",
          borderTop: "1px solid var(--border)",
        }}
      >
        <button
          onClick={prevStep}
          disabled={step === 1}
          style={{
            padding: "0.65rem 1.5rem",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface)",
            color: step === 1 ? "var(--border)" : "var(--text)",
            cursor: step === 1 ? "not-allowed" : "pointer",
            fontWeight: 500,
          }}
        >
          ← Zurück
        </button>

        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          {step} / {TOTAL_STEPS}
        </span>

        {step < TOTAL_STEPS ? (
          <button
            onClick={handleNext}
            style={{
              padding: "0.65rem 1.5rem",
              background: "var(--primary)",
              color: "var(--btn-text)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Weiter →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitState === "loading"}
            style={{
              padding: "0.65rem 1.75rem",
              background: submitState === "loading" ? "var(--muted)" : "var(--text)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontWeight: 600,
              cursor: submitState === "loading" ? "not-allowed" : "pointer",
            }}
          >
            {submitState === "loading" ? "Wird gesendet…" : "Anfragen"}
          </button>
        )}
      </div>
    </div>
  );
}
