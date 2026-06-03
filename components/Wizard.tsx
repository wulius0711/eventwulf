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
      <div className="ew-success">
        <div className="ew-success-icon">✓</div>
        <h2 className="ew-success-title">Anfrage gesendet!</h2>
        <p className="ew-success-msg">Vielen Dank! Wir melden uns so bald wie möglich bei dir.</p>
        <button onClick={() => setSubmitState("idle")} className="ew-btn-primary">
          Neue Anfrage
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="ew-step-bar">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <div key={n} className="ew-step-item">
              <div
                onClick={() => handleStepClick(n)}
                className="ew-step-btn"
                data-reachable={n <= maxStep ? "" : undefined}
                data-clickable={n !== step && n <= maxStep ? "" : undefined}
              >
                <div className="ew-step-circle" data-state={done ? "done" : active ? "active" : "future"}>
                  {done ? "✓" : n}
                </div>
                <span className="step-label" data-active={active ? "" : undefined}>
                  {STEP_LABELS[i]}
                </span>
              </div>
              {n < TOTAL_STEPS && <div className="step-conn" data-done={done ? "" : undefined} />}
            </div>
          );
        })}
      </div>

      {/* Step title */}
      <h2 className="ew-step-title">{STEP_LABELS[step - 1]}</h2>

      {/* Step content */}
      <div key={stepKey.current} className={`ew-step-content${stepClass ? ` ${stepClass}` : ""}`} onAnimationEnd={() => setStepClass("")}>
        {step === 1 && <Step1Veranstaltung slug={slug} config={config} />}
        {step === 2 && <Step2Gruppe config={config} />}
        {step === 3 && <Step3Ausstattung config={config} />}
        {step === 4 && <Step4Verpflegung config={config} />}
        {step === 5 && <Step5Abschluss config={config} />}
      </div>

      {/* Error */}
      {error && <p className="ew-form-error">{error}</p>}

      {/* Navigation */}
      <div className="ew-wizard-nav">
        <button onClick={prevStep} disabled={step === 1} className="ew-btn-secondary">
          ← Zurück
        </button>
        <span className="ew-step-counter">{step} / {TOTAL_STEPS}</span>
        {step < TOTAL_STEPS ? (
          <button onClick={handleNext} className="ew-btn-primary">Weiter →</button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitState === "loading"}
            className="ew-btn-primary"
            data-loading={submitState === "loading" ? "" : undefined}
          >
            {submitState === "loading" ? "Wird gesendet…" : "Anfragen"}
          </button>
        )}
      </div>
    </div>
  );
}
