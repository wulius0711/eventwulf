"use client";
import { useState, useEffect, useRef } from "react";
import { useFormStore, TOTAL_STEPS } from "@/store/form";
import type { EventConfig } from "@/lib/types";
import Step1Veranstaltung from "@/components/steps/Step1Veranstaltung";
import Step2Gruppe from "@/components/steps/Step2Gruppe";
import Step3Ausstattung from "@/components/steps/Step3Ausstattung";
import Step4Verpflegung from "@/components/steps/Step4Verpflegung";
import Step5Abschluss from "@/components/steps/Step5Abschluss";

const STEP_LABELS = ["Veranstaltung", "Gruppe", "Ausstattung", "Verpflegung", "Abschluss"];

interface Props {
  config: EventConfig;
  slug: string;
}

type SubmitState = "idle" | "loading" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(step: number, form: import("@/lib/types").InquiryFormData): string {
  if (step === 1 && !form.artTitel.trim()) return "Bitte Veranstaltungstitel eingeben.";
  if (step === 2 && !form.nameGruppenleitung.trim()) return "Bitte Name der Gruppenleitung eingeben.";
  if (step === 2 && !form.email.trim()) return "Bitte E-Mail-Adresse eingeben.";
  if (step === 2 && form.email.trim() && !EMAIL_RE.test(form.email)) return "Bitte gültige E-Mail-Adresse eingeben.";
  return "";
}

export default function Wizard({ config, slug }: Props) {
  const { form, step, maxStep, nextStep, prevStep, goToStep, reset } = useFormStore();
  const [error, setError] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const isFirst = useRef(true);
  const prevStepRef = useRef(step);
  const [stepClass, setStepClass] = useState("");
  const stepKey = useRef(0);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; prevStepRef.current = step; return; }
    const dir = step > prevStepRef.current ? "cal-slide-next" : "cal-slide-prev";
    prevStepRef.current = step;
    stepKey.current += 1;
    setStepClass(dir);
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => {
      const h = document.getElementById("embed-root")?.offsetHeight ?? document.body.offsetHeight;
      window.parent.postMessage({ type: "eventwulf-resize", height: h, scrollTop: true }, "*");
    });
  }, [step]);

  function handleStepClick(n: number) {
    if (n === step || n > maxStep) return;
    setError("");
    goToStep(n);
  }

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
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.parent.postMessage({ type: "eventwulf-resize", height: document.body.offsetHeight, scrollTop: true }, "*");
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
              <div
                onClick={() => handleStepClick(n)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem", cursor: n !== step && n <= maxStep ? "pointer" : "default", opacity: n <= maxStep ? 1 : 0.4 }}
              >
                <div style={{
                  width: "2.5rem", height: "2.5rem", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.8rem", fontWeight: 700,
                  background: done || active ? "var(--primary)" : "var(--bg2)",
                  color: done || active ? "var(--btn-text)" : "var(--muted)",
                  border: `2px solid ${done || active ? "var(--primary)" : "var(--border)"}`,
                  transition: "all 0.2s",
                }}>
                  {done ? "✓" : n}
                </div>
                <span className="step-label" style={{
                  fontSize: "0.7rem", whiteSpace: "nowrap",
                  color: active ? "var(--primary-text)" : "var(--muted)",
                  fontWeight: active ? 600 : 400,
                }}>
                  {STEP_LABELS[i]}
                </span>
              </div>
              {n < TOTAL_STEPS && (
                <div className="step-conn" style={{
                  flex: 1, height: "2px", margin: "0 0.25rem", marginBottom: "1.2rem",
                  background: done ? "var(--primary)" : "var(--border)",
                  transition: "background 0.2s",
                }} />
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
      <div key={stepKey.current} className={stepClass} onAnimationEnd={() => setStepClass("")} style={{ minHeight: "200px" }}>
        {step === 1 && <Step1Veranstaltung slug={slug} config={config} />}
        {step === 2 && <Step2Gruppe config={config} />}
        {step === 3 && <Step3Ausstattung config={config} />}
        {step === 4 && <Step4Verpflegung config={config} />}
        {step === 5 && <Step5Abschluss config={config} />}
      </div>

      {/* Error */}
      {error && (
        <p style={{ color: "#dc2626", fontSize: "0.85rem", marginTop: "1rem" }}>{error}</p>
      )}

      {/* Navigation */}
      <div
        className="ew-wizard-nav"
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

        <span className="ew-step-counter" style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
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
