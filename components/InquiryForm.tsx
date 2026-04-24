"use client";
import { useState } from "react";
import { useFormStore } from "@/store/form";
import type { YogaConfig } from "@/lib/types";

interface Props {
  config: YogaConfig;
  slug: string;
}

type SubmitState = "idle" | "loading" | "success" | "error";

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <label>{label}</label>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.1rem" }}>
        {(["Ja", "Nein"] as const).map((opt) => {
          const val = opt === "Ja";
          const active = value === val;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(val)}
              style={{
                flex: 1,
                padding: "0.6rem 0",
                border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                borderRadius: "var(--radius-sm)",
                background: active ? "var(--primary-tint)" : "var(--surface)",
                color: active ? "var(--primary)" : "var(--muted)",
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                fontSize: "0.9rem",
                transition: "all 0.15s",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function InquiryForm({ config, slug }: Props) {
  const { form, setField, reset } = useFormStore();
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
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

      setState("success");
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "3rem 2rem",
          background: "var(--surface)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>✓</div>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Anfrage gesendet!
        </h2>
        <p style={{ color: "var(--muted)" }}>
          Vielen Dank! Wir melden uns so bald wie möglich bei dir.
        </p>
        <button
          onClick={() => setState("idle")}
          style={{
            marginTop: "1.5rem",
            padding: "0.6rem 1.5rem",
            background: "var(--primary)",
            color: "var(--btn-text)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Neue Anfrage
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2
        style={{
          textAlign: "center",
          fontSize: "1.6rem",
          fontWeight: 600,
          fontStyle: "italic",
          marginBottom: "2rem",
          color: "var(--text)",
        }}
      >
        {config.formTitle}
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.25rem 1.5rem",
        }}
      >
        {/* Row 1 */}
        <div>
          <label>Art / Titel der Veranstaltung:</label>
          <input
            type="text"
            value={form.artTitel}
            onChange={(e) => setField("artTitel", e.target.value)}
            required
          />
        </div>
        <div>
          <label>Vollständiger Name Gruppenleitung</label>
          <input
            type="text"
            value={form.nameGruppenleitung}
            onChange={(e) => setField("nameGruppenleitung", e.target.value)}
            required
          />
        </div>

        {/* Row 2 */}
        <div>
          <label>Gruppengröße</label>
          <input
            type="text"
            placeholder="5–10"
            value={form.gruppengroesse}
            onChange={(e) => setField("gruppengroesse", e.target.value)}
          />
        </div>
        <div>
          <label>Datum:</label>
          <input
            type="date"
            value={form.datum}
            onChange={(e) => setField("datum", e.target.value)}
          />
        </div>

        {/* Row 3 */}
        <div>
          <label>E-Mail</label>
          <input
            type="email"
            placeholder="E-Mail Adresse"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            required
          />
        </div>
        <div>
          <label>Veranstaltungsbeginn &amp; Ende:</label>
          <textarea
            rows={3}
            value={form.veranstaltungBeginnEnde}
            onChange={(e) => setField("veranstaltungBeginnEnde", e.target.value)}
            style={{ resize: "vertical" }}
          />
        </div>

        {/* Row 4 */}
        <div>
          <label>Personen anzahl: Teilnehmer:innen:</label>
          <input
            type="text"
            placeholder="5-10"
            value={form.personenAnzahl}
            onChange={(e) => setField("personenAnzahl", e.target.value)}
          />
        </div>
        <div>
          <label>Leiter:innen:</label>
          <input
            type="text"
            value={form.leiterinnen}
            onChange={(e) => setField("leiterinnen", e.target.value)}
          />
        </div>

        {/* Row 5 – Ja/Nein toggles */}
        <YesNo
          label="Bestuhlung:"
          value={form.bestuhlung}
          onChange={(v) => setField("bestuhlung", v)}
        />
        <YesNo
          label="Tische:"
          value={form.tische}
          onChange={(v) => setField("tische", v)}
        />

        {/* Row 6 */}
        <div>
          <label>Sonstiges Equipment:</label>
          <textarea
            rows={3}
            placeholder="bspw. Flipchart, Beamer, Yogamatten, ..."
            value={form.sonstigesEquipment}
            onChange={(e) => setField("sonstigesEquipment", e.target.value)}
            style={{ resize: "vertical" }}
          />
        </div>
        <div>
          <label>Verpflegung</label>
          <select
            value={form.verpflegung}
            onChange={(e) => setField("verpflegung", e.target.value)}
          >
            <option value="">Auswählen</option>
            {config.verpflegungOptions.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        {/* Row 7 */}
        <div>
          <label>Zimmerwunsch:</label>
          <select
            value={form.zimmerwunsch}
            onChange={(e) => setField("zimmerwunsch", e.target.value)}
          >
            <option value="">Auswählen</option>
            {config.zimmerwunschOptions.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Wünsche für Rahmenprogramm</label>
          <textarea
            rows={3}
            placeholder="Angebot für Wanderung, Backkurs, Yoga,..."
            value={form.wuenscheRahmenprogramm}
            onChange={(e) => setField("wuenscheRahmenprogramm", e.target.value)}
            style={{ resize: "vertical" }}
          />
        </div>

        {/* Row 8 */}
        <div>
          <label>Abrechnung:</label>
          <select
            value={form.abrechnung}
            onChange={(e) => setField("abrechnung", e.target.value)}
          >
            <option value="">Auswählen</option>
            {config.abrechnungOptions.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            type="submit"
            disabled={state === "loading"}
            style={{
              width: "100%",
              padding: "0.85rem",
              background: state === "loading" ? "var(--muted)" : "var(--text)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontWeight: 600,
              fontSize: "1rem",
              cursor: state === "loading" ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {state === "loading" ? "Wird gesendet…" : "Anfragen"}
          </button>
        </div>
      </div>

      {state === "error" && (
        <p
          style={{
            marginTop: "1rem",
            color: "#dc2626",
            fontSize: "0.9rem",
            textAlign: "center",
          }}
        >
          {error}
        </p>
      )}
    </form>
  );
}
