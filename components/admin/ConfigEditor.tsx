"use client";
import { useState } from "react";
import type { YogaConfig } from "@/lib/types";

interface Props {
  initialConfig: YogaConfig;
  slug: string;
}

type Tab = "firma" | "formular" | "passwort" | "einbetten";

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

function EmbedTab({ slug }: { slug: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://deine-domain.com";
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
        style={{ fontFamily: "monospace", fontSize: "0.78rem", resize: "vertical", background: "var(--bg2)", color: "var(--text)" }}
      />
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(snippet)}
        style={{ alignSelf: "flex-end", padding: "0.55rem 1.25rem", background: "var(--primary)", color: "var(--btn-text)", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}
      >
        Kopieren
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

  function setFormField(field: keyof NonNullable<YogaConfig["formFields"]>, value: boolean) {
    setConfig((c) => ({ ...c, formFields: { ...c.formFields, [field]: value } }));
  }

  function fieldEnabled(field: keyof NonNullable<YogaConfig["formFields"]>) {
    return config.formFields?.[field] !== false;
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
        <button style={tabStyle("einbetten")} onClick={() => setTab("einbetten")}>Einbetten</button>
        <button style={tabStyle("passwort")} onClick={() => setTab("passwort")}>Passwort</button>
      </div>

      {tab === "firma" && (
        <>
          <Section title="Firmendaten">
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.82rem", color: "var(--muted)" }}>
              Diese Daten erscheinen in den Bestätigungs-E-Mails an deine Gäste.
            </p>
            <Field label="Name"><input type="text" value={config.company.name} onChange={(e) => setCompany("name", e.target.value)} /></Field>
            <Field label="Tagline"><input type="text" value={config.company.tagline} onChange={(e) => setCompany("tagline", e.target.value)} /></Field>
            <Field label="E-Mail"><input type="email" value={config.company.email} onChange={(e) => setCompany("email", e.target.value)} /></Field>
            <Field label="Telefon"><input type="text" value={config.company.phone} onChange={(e) => setCompany("phone", e.target.value)} /></Field>
            <Field label="Website"><input type="text" value={config.company.website} onChange={(e) => setCompany("website", e.target.value)} /></Field>
            <Field label="Adresse"><input type="text" value={config.company.address} onChange={(e) => setCompany("address", e.target.value)} /></Field>
            <Field label="Benachrichtigungs-E-Mail"><input type="email" value={config.notifyEmail} onChange={(e) => set("notifyEmail", e.target.value)} /></Field>
          </Section>

        </>
      )}

      {tab === "formular" && (
        <Section title="Formular">
          <Field label="Formular-Titel (optional, leer lassen zum Ausblenden)">
            <input type="text" value={config.formTitle} onChange={(e) => set("formTitle", e.target.value)} placeholder="z.B. Du hast Interesse an einem Retreat bei uns?" />
          </Field>
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
                  Zurücksetzen
                </button>
              )}
            </div>
          </Field>
          <Field label="Schriftart Titel">
            <select value={config.formTitleFont ?? "Cormorant Garamond"} onChange={(e) => set("formTitleFont", e.target.value)}>
              <option value="Cormorant Garamond">Cormorant Garamond – elegant, dünn</option>
              <option value="Playfair Display">Playfair Display – klassisch, serif</option>
              <option value="Lora">Lora – warm, lesbar</option>
              <option value="DM Serif Display">DM Serif Display – modern, markant</option>
              <option value="EB Garamond">EB Garamond – zeitlos, fein</option>
              <option value="Georgia, serif">Georgia – systemfont, schlicht</option>
            </select>
          </Field>
          <OptionsEditor field="verpflegungOptions" label="Verpflegung-Optionen" />
          <OptionsEditor field="zimmerwunschOptions" label="Zimmerwunsch-Optionen" />
          <OptionsEditor field="abrechnungOptions" label="Abrechnungs-Optionen" />

          <div style={{ marginTop: "0.5rem" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "0.75rem" }}>Optionale Felder ein-/ausblenden</div>
            {([
              ["telefon",        "Telefon (Gruppenleitung)"],
              ["sprache",        "Sprache der Gruppe"],
              ["anreise",        "Anreise"],
              ["barrierefreiheit", "Besondere Bedürfnisse / Barrierefreiheit"],
              ["budget",         "Budgetrahmen"],
              ["quelle",         "Wie habt ihr uns gefunden?"],
            ] as [keyof NonNullable<YogaConfig["formFields"]>, string][]).map(([field, label]) => (
              <label key={field} style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem", cursor: "pointer", fontSize: "0.88rem", color: "var(--text)", fontWeight: 400 }}>
                <input
                  type="checkbox"
                  checked={fieldEnabled(field)}
                  onChange={(e) => setFormField(field, e.target.checked)}
                  style={{ width: "auto", cursor: "pointer" }}
                />
                {label}
              </label>
            ))}
          </div>
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
