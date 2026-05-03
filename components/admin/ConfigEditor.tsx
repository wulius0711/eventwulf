"use client";
import { useState, useEffect } from "react";
import type { EventConfig } from "@/lib/types";

interface Props {
  initialConfig: EventConfig;
  slug: string;
}

type Tab = "firma" | "formular" | "abrechnung" | "passwort" | "einbetten";

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

function EmbedTab({ slug }: { slug: string }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const src = `${origin}/?kunde=${slug}`;

  const snippet = `<iframe id="eventwulf-widget" src="${src}" width="100%" frameborder="0" style="border:none;display:block" scrolling="no"></iframe>
<script>window.addEventListener('message',function(e){var f=document.getElementById('eventwulf-widget');if(!f||!e.data||e.data.type!=='eventwulf-resize')return;f.style.height=e.data.height+'px';if(e.data.scrollTop){var t=f.getBoundingClientRect().top+window.pageYOffset;window.scrollTo({top:t,behavior:'smooth'});}});<\/script>`;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--muted)" }}>
        Diesen Code in deine Website einfügen (z.B. im HTML-Editor deines CMS):
      </p>
      <textarea
        readOnly
        value={snippet}
        rows={6}
        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        style={{ fontFamily: "monospace", fontSize: "0.78rem", resize: "vertical", background: "var(--bg2)", color: "var(--text)", wordBreak: "break-all", overflowWrap: "break-word" }}
      />
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(snippet)}
        style={{ padding: "0.65rem 1.25rem", background: "var(--primary)", color: "var(--btn-text)", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem", width: "100%" }}
      >
        Code kopieren
      </button>
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

export default function ConfigEditor({ initialConfig, slug }: Props) {
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

  function setFormField(field: keyof NonNullable<EventConfig["formFields"]>, value: boolean) {
    setConfig((c) => ({ ...c, formFields: { ...c.formFields, [field]: value } }));
  }

  function fieldEnabled(field: keyof NonNullable<EventConfig["formFields"]>) {
    return config.formFields?.[field] !== false;
  }

  function setCompany(key: keyof EventConfig["company"], value: string) {
    setConfig((c) => ({ ...c, company: { ...c.company, [key]: value } }));
  }

  function setListItem(field: "verpflegungOptions" | "zimmerwunschOptions" | "abrechnungOptions" | "ausstattungOptions" | "anreiseOptions" | "zahlungOptions" | "budgetOptions" | "quelleOptions", idx: number, value: string) {
    setConfig((c) => {
      const arr = [...c[field]];
      arr[idx] = value;
      return { ...c, [field]: arr };
    });
  }

  function addListItem(field: "verpflegungOptions" | "zimmerwunschOptions" | "abrechnungOptions" | "ausstattungOptions" | "anreiseOptions" | "zahlungOptions" | "budgetOptions" | "quelleOptions") {
    setConfig((c) => ({ ...c, [field]: [...c[field], ""] }));
  }

  function removeListItem(field: "verpflegungOptions" | "zimmerwunschOptions" | "abrechnungOptions" | "ausstattungOptions" | "anreiseOptions" | "zahlungOptions" | "budgetOptions" | "quelleOptions", idx: number) {
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

  function OptionsEditor({ field, label }: { field: "verpflegungOptions" | "zimmerwunschOptions" | "abrechnungOptions" | "ausstattungOptions" | "anreiseOptions" | "zahlungOptions" | "budgetOptions" | "quelleOptions"; label: string }) {
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
        className="config-tabs"
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          marginBottom: "1.5rem",
          gap: "0.25rem",
        }}
      >
        <button style={tabStyle("firma")} onClick={() => setTab("firma")}>Firma</button>
        <button style={tabStyle("formular")} onClick={() => setTab("formular")}>Formular</button>
        <button style={tabStyle("abrechnung")} onClick={() => setTab("abrechnung")}>Abrechnung</button>
        <button style={tabStyle("einbetten")} onClick={() => setTab("einbetten")}>Einbetten</button>
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

      {tab === "formular" && (
        <>
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
                  <input type="color" value={config.formBgColor || "#f5f0e8"} onChange={(e) => set("formBgColor", e.target.value)} style={{ width: "3rem", height: "2.5rem", padding: "0.2rem", cursor: "pointer" }} />
                  <input type="text" value={config.formBgColor ?? ""} onChange={(e) => set("formBgColor", e.target.value)} placeholder="transparent" style={{ flex: 1 }} />
                  {config.formBgColor && (
                    <button type="button" onClick={() => set("formBgColor", "")} style={{ padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      ×
                    </button>
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
              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", cursor: "pointer", fontSize: "0.88rem" }}>
                <input type="checkbox" checked={config.showPackages === true} onChange={(e) => set("showPackages", e.target.checked)} style={{ width: "auto", cursor: "pointer", marginTop: "0.1rem", flexShrink: 0 }} />
                <span>
                  <strong>Seminarpakete anzeigen</strong>
                  <span style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)" }}>Zeigt eine Paketauswahl in Schritt 1 des Buchungsformulars</span>
                </span>
              </label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", cursor: "pointer", fontSize: "0.88rem" }}>
                <input type="checkbox" checked={config.showCapacity === true} onChange={(e) => set("showCapacity", e.target.checked)} style={{ width: "auto", cursor: "pointer", marginTop: "0.1rem", flexShrink: 0 }} />
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
                  { key: "verpflegung" as const,  label: "Verpflegung" },
                  { key: "zimmerwunsch" as const,  label: "Zimmerwunsch" },
                ],
              },
              {
                label: "Schritt 5 – Abschluss",
                fields: [
                  { key: "wuenscheRahmenprogramm" as const, label: "Wünsche Rahmenprogramm" },
                  { key: "abrechnung" as const,             label: "Abrechnung",                  hint: "Optionen ↓" },
                  { key: "zahlung" as const,                label: "Zahlung",                      hint: "Optionen ↓" },
                  { key: "anreise" as const,                label: "Anreise",                      hint: "Optionen ↓" },
                  { key: "barrierefreiheit" as const,       label: "Besondere Bedürfnisse" },
                  { key: "budget" as const,                 label: "Budgetrahmen",                 hint: "Optionen ↓" },
                  { key: "quelle" as const,                 label: "Wie habt ihr uns gefunden?",   hint: "Optionen ↓" },
                ],
              },
            ] as { label: string; fields: { key: keyof NonNullable<EventConfig["formFields"]>; label: string; hint?: string }[] }[]).map((step) => (
              <div key={step.label} style={{ marginBottom: "1.5rem" }}>
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
                    <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: "0.55rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={fieldEnabled(key)}
                        onChange={(e) => setFormField(key, e.target.checked)}
                        style={{ width: "auto", cursor: "pointer", flexShrink: 0, marginTop: "0.2rem" }}
                      />
                      <span style={{ fontSize: "0.875rem", lineHeight: 1.4 }}>
                        {label}
                        {hint && <span style={{ display: "block", fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.1rem" }}>{hint}</span>}
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

      {tab === "einbetten" && (
        <EmbedTab slug={slug} />
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "1rem", marginTop: "1rem" }}>
          {saved && <span style={{ color: "#16a34a", fontSize: "0.85rem" }}>Gespeichert ✓</span>}
          {saveError && <span style={{ color: "#dc2626", fontSize: "0.85rem" }}>{saveError}</span>}
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
