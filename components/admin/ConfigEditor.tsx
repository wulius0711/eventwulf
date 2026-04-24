"use client";
import { useState } from "react";
import type { YogaConfig } from "@/lib/types";

interface Props {
  initialConfig: YogaConfig;
}

type Tab = "firma" | "formular" | "passwort";

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
      <h2 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "1.25rem" }}>{title}</h2>
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

export default function ConfigEditor({ initialConfig }: Props) {
  const [config, setConfig] = useState<YogaConfig>(initialConfig);
  const [tab, setTab] = useState<Tab>("firma");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Password change state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  function set<K extends keyof YogaConfig>(key: K, value: YogaConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function setCompany(key: keyof YogaConfig["company"], value: string) {
    setConfig((c) => ({ ...c, company: { ...c.company, [key]: value } }));
  }

  function setListItem(field: "verpflegungOptions" | "zimmerwunschOptions" | "abrechnungOptions", idx: number, value: string) {
    setConfig((c) => {
      const arr = [...c[field]];
      arr[idx] = value;
      return { ...c, [field]: arr };
    });
  }

  function addListItem(field: "verpflegungOptions" | "zimmerwunschOptions" | "abrechnungOptions") {
    setConfig((c) => ({ ...c, [field]: [...c[field], ""] }));
  }

  function removeListItem(field: "verpflegungOptions" | "zimmerwunschOptions" | "abrechnungOptions", idx: number) {
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

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg("");
    const res = await fetch("/api/admin/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setPwMsg("Passwort geändert.");
      setCurrentPw("");
      setNewPw("");
    } else {
      setPwMsg(data.error ?? "Fehler");
    }
  }

  function OptionsEditor({ field, label }: { field: "verpflegungOptions" | "zimmerwunschOptions" | "abrechnungOptions"; label: string }) {
    return (
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "0.5rem" }}>{label}</div>
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
                color: "#dc2626",
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

  const tabStyle = (t: Tab) => ({
    padding: "0.5rem 1rem",
    border: "none",
    borderBottom: `2px solid ${tab === t ? "var(--primary)" : "transparent"}`,
    background: "none",
    color: tab === t ? "var(--primary)" : "var(--muted)",
    cursor: "pointer",
    fontWeight: tab === t ? 600 : 400,
    fontSize: "0.88rem",
  });

  return (
    <div>
      {/* Tab nav */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          marginBottom: "1.5rem",
          gap: "0.25rem",
        }}
      >
        <button style={tabStyle("firma")} onClick={() => setTab("firma")}>Firma</button>
        <button style={tabStyle("formular")} onClick={() => setTab("formular")}>Formular</button>
        <button style={tabStyle("passwort")} onClick={() => setTab("passwort")}>Passwort</button>
      </div>

      {tab === "firma" && (
        <>
          <Section title="Firmendaten">
            <Field label="Name"><input type="text" value={config.company.name} onChange={(e) => setCompany("name", e.target.value)} /></Field>
            <Field label="Tagline"><input type="text" value={config.company.tagline} onChange={(e) => setCompany("tagline", e.target.value)} /></Field>
            <Field label="E-Mail"><input type="email" value={config.company.email} onChange={(e) => setCompany("email", e.target.value)} /></Field>
            <Field label="Telefon"><input type="text" value={config.company.phone} onChange={(e) => setCompany("phone", e.target.value)} /></Field>
            <Field label="Website"><input type="text" value={config.company.website} onChange={(e) => setCompany("website", e.target.value)} /></Field>
            <Field label="Adresse"><input type="text" value={config.company.address} onChange={(e) => setCompany("address", e.target.value)} /></Field>
            <Field label="Benachrichtigungs-E-Mail"><input type="email" value={config.notifyEmail} onChange={(e) => set("notifyEmail", e.target.value)} /></Field>
          </Section>

          <Section title="Design">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Field label="Primärfarbe">
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input type="color" value={config.company.primaryColor} onChange={(e) => setCompany("primaryColor", e.target.value)} style={{ width: "3rem", height: "2.5rem", padding: "0.2rem", cursor: "pointer" }} />
                  <input type="text" value={config.company.primaryColor} onChange={(e) => setCompany("primaryColor", e.target.value)} style={{ flex: 1 }} />
                </div>
              </Field>
              <Field label="Akzentfarbe">
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input type="color" value={config.company.accentColor} onChange={(e) => setCompany("accentColor", e.target.value)} style={{ width: "3rem", height: "2.5rem", padding: "0.2rem", cursor: "pointer" }} />
                  <input type="text" value={config.company.accentColor} onChange={(e) => setCompany("accentColor", e.target.value)} style={{ flex: 1 }} />
                </div>
              </Field>
            </div>
          </Section>
        </>
      )}

      {tab === "formular" && (
        <Section title="Formular">
          <Field label="Formular-Titel">
            <input type="text" value={config.formTitle} onChange={(e) => set("formTitle", e.target.value)} />
          </Field>
          <OptionsEditor field="verpflegungOptions" label="Verpflegung-Optionen" />
          <OptionsEditor field="zimmerwunschOptions" label="Zimmerwunsch-Optionen" />
          <OptionsEditor field="abrechnungOptions" label="Abrechnungs-Optionen" />
        </Section>
      )}

      {tab === "passwort" && (
        <Section title="Passwort ändern">
          <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "380px" }}>
            <Field label="Aktuelles Passwort">
              <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required autoComplete="current-password" />
            </Field>
            <Field label="Neues Passwort">
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required autoComplete="new-password" minLength={8} />
            </Field>
            {pwMsg && <p style={{ color: pwMsg.includes("Fehler") || pwMsg.includes("falsch") ? "#dc2626" : "#16a34a", fontSize: "0.85rem", margin: 0 }}>{pwMsg}</p>}
            <button type="submit" style={{ padding: "0.65rem 1.5rem", background: "var(--primary)", color: "var(--btn-text)", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
              Speichern
            </button>
          </form>
        </Section>
      )}

      {/* Save bar (only for firma/formular tabs) */}
      {tab !== "passwort" && (
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
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
          {saved && <span style={{ color: "#16a34a", fontSize: "0.85rem" }}>Gespeichert ✓</span>}
          {saveError && <span style={{ color: "#dc2626", fontSize: "0.85rem" }}>{saveError}</span>}
        </div>
      )}
    </div>
  );
}
