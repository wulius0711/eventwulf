"use client";
import { useState } from "react";
import type { EventConfig } from "@/lib/types";
import Toggle from "@/components/admin/Toggle";

interface Props {
  initialConfig: EventConfig;
}

type OptionsField = "verpflegungOptions" | "zimmerwunschOptions" | "abrechnungOptions" | "ausstattungOptions" | "anreiseOptions" | "zahlungOptions" | "budgetOptions" | "quelleOptions";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "1.5rem",
        marginBottom: "1.25rem",
      }}
    >
      <h2 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "1.25rem", color: "var(--text)" }}>{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export default function FormularEditor({ initialConfig }: Props) {
  const [config, setConfig] = useState<EventConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  function set<K extends keyof EventConfig>(key: K, value: EventConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function setCompany(key: keyof EventConfig["company"], value: string) {
    setConfig((c) => ({ ...c, company: { ...c.company, [key]: value } }));
  }

  function setFormField(field: keyof NonNullable<EventConfig["formFields"]>, value: boolean) {
    setConfig((c) => ({ ...c, formFields: { ...c.formFields, [field]: value } }));
  }

  function fieldEnabled(field: keyof NonNullable<EventConfig["formFields"]>) {
    return config.formFields?.[field] !== false;
  }

  function setListItem(field: OptionsField, idx: number, value: string) {
    setConfig((c) => {
      const arr = [...c[field]];
      arr[idx] = value;
      return { ...c, [field]: arr };
    });
  }

  function addListItem(field: OptionsField) {
    setConfig((c) => ({ ...c, [field]: [...c[field], ""] }));
  }

  function removeListItem(field: OptionsField, idx: number) {
    setConfig((c) => ({ ...c, [field]: c[field].filter((_, i) => i !== idx) }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError("");

    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      setSaveError("Fehler beim Speichern");
    }
  }

  function OptionsEditor({ field, label }: { field: OptionsField; label: string }) {
    return (
      <div>
        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.6rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.4rem" }}>{label}</div>
        {config[field].map((item, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
            <input
              type="text"
              value={item}
              onChange={(e) => setListItem(field, i, e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => removeListItem(field, i)}
              style={{
                padding: "0 0.75rem",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                background: "none",
                color: "var(--error)",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => addListItem(field)}
          style={{
            padding: "0.35rem 0.85rem",
            border: "1px dashed var(--border)",
            borderRadius: "var(--radius-sm)",
            background: "none",
            color: "var(--muted)",
            cursor: "pointer",
            fontSize: "0.82rem",
            marginTop: "0.25rem",
          }}
        >
          + Option hinzufügen
        </button>
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        Titel, Farben, Schriftarten und Felder deines Buchungsformulars — steuert, was Gäste im Anfrageformular sehen und ausfüllen können.
      </p>
      <Section title="Formular">
        <Field label="Formular-Titel (optional, leer lassen zum Ausblenden)">
          <input type="text" value={config.formTitle} onChange={(e) => set("formTitle", e.target.value)} placeholder="z.B. Du hast Interesse an einem Retreat bei uns?" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4" style={{ marginBottom: "1rem" }}>
          <Field label="Primärfarbe">
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input type="color" value={config.company.primaryColor} onChange={(e) => setCompany("primaryColor", e.target.value)} style={{ width: "3rem", height: "2.5rem", padding: "0.2rem", cursor: "pointer" }} />
              <input type="text" value={config.company.primaryColor} onChange={(e) => setCompany("primaryColor", e.target.value)} style={{ flex: 1 }} />
            </div>
          </Field>
          <Field label="Hintergrundfarbe (leer = transparent)">
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {config.formBgColor ? (
                <>
                  <input type="color" value={config.formBgColor} onChange={(e) => set("formBgColor", e.target.value)} style={{ width: "3rem", height: "2.5rem", padding: "0.2rem", cursor: "pointer" }} />
                  <input type="text" value={config.formBgColor} onChange={(e) => set("formBgColor", e.target.value)} placeholder="transparent" style={{ flex: 1 }} />
                  <button type="button" onClick={() => set("formBgColor", "")} style={{ padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    ×
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => set("formBgColor", "#f5f0e8")}
                    title="Farbe wählen"
                    style={{
                      width: "3rem", height: "2.5rem", borderRadius: "4px", cursor: "pointer",
                      border: "1px dashed var(--border)",
                      backgroundImage: "repeating-conic-gradient(var(--bg2) 0% 25%, transparent 0% 50%)",
                      backgroundSize: "10px 10px",
                    }}
                  />
                  <input type="text" value="" onChange={(e) => e.target.value && set("formBgColor", e.target.value)} placeholder="transparent" style={{ flex: 1 }} />
                </>
              )}
            </div>
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4" style={{ marginBottom: "1rem" }}>
          <Field label="Schriftart Überschrift">
            <select value={config.formTitleFont ?? "Cormorant Garamond"} onChange={(e) => set("formTitleFont", e.target.value)}>
              <option value="Cormorant Garamond">Cormorant Garamond – elegant, dünn</option>
              <option value="Playfair Display">Playfair Display – klassisch, serif</option>
              <option value="Lora">Lora – warm, lesbar</option>
              <option value="DM Serif Display">DM Serif Display – modern, markant</option>
              <option value="EB Garamond">EB Garamond – zeitlos, fein</option>
              <option value="Georgia">Georgia – systemfont, schlicht</option>
            </select>
          </Field>
          <Field label="Schriftart Fließtext">
            <select value={config.formBodyFont ?? ""} onChange={(e) => set("formBodyFont", e.target.value)}>
              <option value="">System UI – Standard (sans-serif)</option>
              <option value="Inter">Inter – modern, neutral</option>
              <option value="Lato">Lato – freundlich, rund</option>
              <option value="Source Sans 3">Source Sans 3 – klar, lesbar</option>
              <option value="Nunito">Nunito – weich, warm</option>
              <option value="Lora">Lora – klassisch, serif</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Widget-Features">
        <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "var(--muted)" }}>
          Diese Features sind standardmäßig ausgeblendet und müssen explizit aktiviert werden.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", fontSize: "0.88rem" }}>
            <Toggle checked={config.showCapacity === true} onChange={(v) => set("showCapacity", v)} />
            <span>
              <strong>Verfügbare Plätze anzeigen</strong>
              <span style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)" }}>Zeigt verbleibende Kapazität im Kalender (erfordert konfigurierte Kapazitäten)</span>
            </span>
          </label>
        </div>
      </Section>

      <Section title="Felder">
        <p style={{ margin: "0 0 1.5rem", fontSize: "0.82rem", color: "var(--muted)" }}>
          Aktiviere oder deaktiviere einzelne Felder im Buchungsformular.
        </p>

        {([
          {
            label: "Schritt 1 – Veranstaltung",
            fields: [
              { key: "uhrzeiten" as const, label: "Uhrzeiten (Beginn / Ende)" },
            ],
          },
          {
            label: "Schritt 2 – Gruppe",
            fields: [
              { key: "personenAnzahl" as const, label: "Anzahl Teilnehmer:innen" },
              { key: "leiterinnen" as const,    label: "Leiter:innen" },
              { key: "telefon" as const,        label: "Telefon" },
              { key: "sprache" as const,        label: "Sprache der Gruppe" },
            ],
          },
          {
            label: "Schritt 3 – Ausstattung",
            fields: [
              { key: "sonstigesEquipment" as const, label: "Sonstiges Equipment (Freitextfeld)" },
            ],
          },
          {
            label: "Schritt 4 – Unterkunft",
            fields: [
              { key: "verpflegung" as const,  label: "Verpflegung",  hint: "Optionen unten wählbar" },
              { key: "zimmerwunsch" as const,  label: "Zimmerwunsch", hint: "Optionen unten wählbar" },
            ],
          },
          {
            label: "Schritt 5 – Abschluss",
            fields: [
              { key: "wuenscheRahmenprogramm" as const, label: "Wünsche Rahmenprogramm" },
              { key: "abrechnung" as const,             label: "Abrechnung",                  hint: "Optionen unten wählbar" },
              { key: "zahlung" as const,                label: "Zahlung",                      hint: "Optionen unten wählbar" },
              { key: "anreise" as const,                label: "Anreise",                      hint: "Optionen unten wählbar" },
              { key: "barrierefreiheit" as const,       label: "Besondere Bedürfnisse" },
              { key: "budget" as const,                 label: "Budgetrahmen",                 hint: "Optionen unten wählbar" },
              { key: "quelle" as const,                 label: "Wie habt ihr uns gefunden?",   hint: "Optionen unten wählbar" },
            ],
          },
        ] as { label: string; fields: { key: keyof NonNullable<EventConfig["formFields"]>; label: string; hint?: string }[] }[]).map((step) => (
          <div key={step.label} style={{ marginBottom: "2.5rem" }}>
            <div style={{
              fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.07em", color: "var(--muted)",
              paddingBottom: "0.5rem", marginBottom: "0.75rem",
              borderBottom: "1px solid var(--border)",
            }}>
              {step.label}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))", gap: "0.5rem 1.5rem" }}>
              {step.fields.map(({ key, label, hint }) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <Toggle checked={fieldEnabled(key)} onChange={(v) => setFormField(key, v)} />
                  <span style={{ fontSize: "0.875rem", lineHeight: 1.4 }}>
                    {label}
                    {hint && <span style={{ display: "block", fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.1rem" }}>({hint})</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div style={{ borderTop: "1px solid var(--border)", marginTop: "0.5rem", paddingTop: "1.5rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)", marginBottom: "1.25rem" }}>
            Auswahloptionen konfigurieren
          </div>
          <div className="ew-options-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))", gap: "1.5rem 2.5rem" }}>
            <OptionsEditor field="ausstattungOptions"  label="Ausstattung" />
            <OptionsEditor field="verpflegungOptions"  label="Verpflegung" />
            <OptionsEditor field="zimmerwunschOptions" label="Zimmerwunsch" />
            <OptionsEditor field="abrechnungOptions"   label="Abrechnung" />
            <OptionsEditor field="zahlungOptions"      label="Zahlung" />
            <OptionsEditor field="anreiseOptions"      label="Anreise" />
            <OptionsEditor field="budgetOptions"       label="Budgetrahmen" />
            <OptionsEditor field="quelleOptions"       label="Wie habt ihr uns gefunden?" />
          </div>
        </div>
      </Section>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "1rem", marginTop: "1rem" }}>
        {saved && <span style={{ color: "#16a34a", fontSize: "0.85rem" }}>Gespeichert ✓</span>}
        {saveError && <span style={{ color: "var(--error)", fontSize: "0.85rem" }}>{saveError}</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "0.65rem 1.75rem",
            background: "var(--primary)",
            color: "var(--btn-text)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Speichern…" : "Änderungen speichern"}
        </button>
      </div>
    </div>
  );
}
