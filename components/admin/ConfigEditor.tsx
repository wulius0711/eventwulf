"use client";
import { useState, useEffect } from "react";
import type { EventConfig } from "@/lib/types";

interface Props {
  initialConfig: EventConfig;
}

type Tab = "firma" | "abrechnung" | "passwort";

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

export default function ConfigEditor({ initialConfig }: Props) {
  const [config, setConfig] = useState<EventConfig>(initialConfig);
  const [tab, setTab] = useState<Tab>("firma");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Password change state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  function set<K extends keyof EventConfig>(key: K, value: EventConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function setCompany(key: keyof EventConfig["company"], value: string) {
    setConfig((c) => ({ ...c, company: { ...c.company, [key]: value } }));
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
        className="config-tabs"
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          marginBottom: "1.5rem",
          gap: "0.25rem",
        }}
      >
        <button style={tabStyle("firma")} onClick={() => setTab("firma")}>Firma</button>
        <button style={tabStyle("abrechnung")} onClick={() => setTab("abrechnung")}>Abrechnung</button>
        <button style={tabStyle("passwort")} onClick={() => setTab("passwort")}>Passwort</button>
      </div>

      {tab === "firma" && (
        <>
          <Section title="Firmendaten">
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.82rem", color: "var(--muted)" }}>
              Diese Daten erscheinen in den Bestätigungs-E-Mails an deine Gäste.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Name"><input type="text" value={config.company.name} onChange={(e) => setCompany("name", e.target.value)} /></Field>
              <Field label="Tagline"><input type="text" value={config.company.tagline} onChange={(e) => setCompany("tagline", e.target.value)} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="E-Mail (sichtbar für Gäste)"><input type="email" value={config.company.email} onChange={(e) => setCompany("email", e.target.value)} /></Field>
              <Field label="Telefon"><input type="text" value={config.company.phone} onChange={(e) => setCompany("phone", e.target.value)} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Website"><input type="text" value={config.company.website} onChange={(e) => setCompany("website", e.target.value)} /></Field>
              <Field label="Adresse"><input type="text" value={config.company.address} onChange={(e) => setCompany("address", e.target.value)} /></Field>
            </div>
            <Field label="Benachrichtigungs-E-Mail (erhält neue Anfragen intern)"><input type="email" value={config.notifyEmail} onChange={(e) => set("notifyEmail", e.target.value)} /></Field>
          </Section>

        </>
      )}

      {tab === "abrechnung" && (
        <Section title="Angebotseinstellungen">
          <Field label="Steuersatz (%)">
            <input type="number" min="0" max="100" step="1" value={Math.round((config.billing?.taxRate ?? 0.20) * 100)} onChange={(e) => set("billing", { ...config.billing, taxRate: (parseInt(e.target.value) || 20) / 100 })} style={{ maxWidth: "120px" }} />
          </Field>
          <Field label="Angebot gültig für (Tage)">
            <input type="number" min="1" max="365" value={config.billing?.validityDays ?? 30} onChange={(e) => set("billing", { ...config.billing, validityDays: parseInt(e.target.value) || 30 })} style={{ maxWidth: "120px" }} />
          </Field>
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
            {pwMsg && <p style={{ color: pwMsg.includes("Fehler") || pwMsg.includes("falsch") ? "var(--error)" : "#16a34a", fontSize: "0.85rem", margin: 0 }}>{pwMsg}</p>}
            <button type="submit" style={{ padding: "0.65rem 1.5rem", background: "var(--primary)", color: "var(--btn-text)", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
              Speichern
            </button>
          </form>
        </Section>
      )}

      {/* Save bar (only for firma/formular tabs) */}
      {tab !== "passwort" && (
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
      )}
    </div>
  );
}
