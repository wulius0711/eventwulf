"use client";
import { useState, useEffect } from "react";
import type { EventConfig, InquiryFormData } from "@/lib/types";
import InvoicePanel from "@/components/admin/InvoicePanel";
import { useToast } from "@/components/admin/Toast";
import { InboxEmptyIcon, FilterEmptyIcon } from "@/components/admin/icons";

interface Inquiry {
  id: string;
  data: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
  eventId: string | null;
  holdExpiresAt: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  neu:               "Neu",
  in_pruefung:       "In Prüfung",
  angebot_versendet: "Angebot versendet",
  bestaetigt:        "Bestätigt",
  abgelehnt:         "Abgelehnt",
  storniert:         "Storniert",
  abgelaufen:        "Abgelaufen",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  neu:               { bg: "var(--badge-new-bg)",       color: "var(--badge-new-text)" },
  in_pruefung:       { bg: "var(--badge-pending-bg)",   color: "var(--badge-pending-text)" },
  angebot_versendet: { bg: "var(--badge-offer-bg)",     color: "var(--badge-offer-text)" },
  bestaetigt:        { bg: "var(--badge-confirmed-bg)", color: "var(--badge-confirmed-text)" },
  abgelehnt:         { bg: "var(--badge-cancelled-bg)", color: "var(--badge-cancelled-text)" },
  storniert:         { bg: "var(--badge-neutral-bg)",   color: "var(--badge-neutral-text)" },
  abgelaufen:        { bg: "var(--badge-neutral-bg)",   color: "var(--badge-neutral-text)" },
};

// "Erledigt" bündelt die drei toten Endzustände zu einer Gruppe, damit die
// Filterleiste nicht drei kaum genutzte Einzel-Tabs braucht.
const STATUS_GROUPS: { key: string; label: string; statuses: string[] | null }[] = [
  { key: "alle",              label: "Alle",              statuses: null },
  { key: "neu",                label: "Neu",               statuses: ["neu"] },
  { key: "in_pruefung",        label: "In Prüfung",        statuses: ["in_pruefung"] },
  { key: "angebot_versendet",  label: "Angebot versendet",  statuses: ["angebot_versendet"] },
  { key: "bestaetigt",         label: "Bestätigt",         statuses: ["bestaetigt"] },
  { key: "erledigt",           label: "Erledigt",          statuses: ["abgelehnt", "storniert", "abgelaufen"] },
];

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// holdExpiresAt is only set while an inquiry is still "neu"/"in_pruefung"/
// "angebot_versendet" (see PATCH handler in app/api/admin/inquiries/route.ts) —
// its mere presence already implies the inquiry is still pending.
function fmtHoldRemaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "läuft gleich ab";
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 1) return "läuft in Kürze ab";
  if (hours < 24) return `läuft ab in ${hours} Std.`;
  const days = Math.round(hours / 24);
  return `läuft ab in ${days} Tag${days === 1 ? "" : "en"}`;
}

function fmtDate(isoDate: string) {
  if (!isoDate) return "–";
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value || value === "–") return null;
  return (
    <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.82rem" }}>
      <span style={{ color: "var(--muted)", minWidth: "110px", flexShrink: 0 }}>{label}</span>
      <span style={{ color: "var(--text)" }}>{value}</span>
    </div>
  );
}

export default function InquiryInbox({ config }: { config: EventConfig }) {
  const { showToast } = useToast();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("alle");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/inquiries")
      .then((r) => r.json())
      .then((data) => { setInquiries(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function setStatus(id: string, status: string) {
    const current = inquiries.find((i) => i.id === id);
    if (!current) return;
    const res = await fetch("/api/admin/inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, updatedAt: current.updatedAt }),
    });
    if (res.ok) {
      const updated = await res.json() as Inquiry;
      setInquiries((prev) => prev.map((i) => i.id === id ? { ...i, status: updated.status, updatedAt: updated.updatedAt } : i));
      showToast("success", "Status aktualisiert");
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string };
      showToast("error", d.error ?? "Fehler beim Ändern des Status");
      if (res.status === 409) {
        fetch("/api/admin/inquiries").then((r) => r.json()).then(setInquiries).catch(() => {});
      }
    }
  }

  async function deleteInquiry(id: string, label: string) {
    if (!window.confirm(`Anfrage „${label}" wirklich löschen?`)) return;
    const res = await fetch("/api/admin/inquiries", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) { setInquiries((prev) => prev.filter((i) => i.id !== id)); showToast("success", "Anfrage gelöscht"); }
    else showToast("error", "Fehler beim Löschen");
  }

  if (loading) return <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Lade Anfragen…</p>;
  if (inquiries.length === 0) {
    return (
      <div className="ew-empty-state">
        <span className="ew-empty-state-icon">{InboxEmptyIcon}</span>
        <div className="ew-empty-state-title">Noch keine Anfragen</div>
        <p className="ew-empty-state-body">Hier erscheinen Anfragen, sobald jemand über dein Buchungswidget anfragt.</p>
      </div>
    );
  }

  const activeGroup = STATUS_GROUPS.find((g) => g.key === statusFilter) ?? STATUS_GROUPS[0];
  const parsed = inquiries.map((inq) => ({ inq, d: JSON.parse(inq.data) as InquiryFormData }));
  const filtered = parsed.filter(({ inq, d }) => {
    if (activeGroup.statuses && !activeGroup.statuses.includes(inq.status)) return false;
    if (search.trim()) {
      const haystack = `${d.artTitel ?? ""} ${d.nameGruppenleitung ?? ""} ${d.email ?? ""}`.toLowerCase();
      if (!haystack.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="ew-inq-filterbar" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {STATUS_GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setStatusFilter(g.key)}
              style={{
                padding: "0.35rem 0.85rem", borderRadius: "999px", fontSize: "0.8rem", fontWeight: 600,
                border: `1px solid ${statusFilter === g.key ? "var(--primary)" : "var(--border)"}`,
                background: statusFilter === g.key ? "var(--primary-tint)" : "none",
                color: statusFilter === g.key ? "var(--primary-text)" : "var(--muted)",
                cursor: "pointer",
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nach Titel, Name oder E-Mail filtern…"
          style={{ width: "auto", minWidth: "300px" }}
        />
      </div>

      {filtered.length === 0 && (
        <div className="ew-empty-state">
          <span className="ew-empty-state-icon">{FilterEmptyIcon}</span>
          <div className="ew-empty-state-title">Keine Treffer</div>
          <p className="ew-empty-state-body">Für „{STATUS_GROUPS.find((g) => g.key === statusFilter)?.label}"{search.trim() ? ` und „${search}"` : ""} wurde nichts gefunden.</p>
          <button type="button" className="ew-admin-btn ew-admin-btn-outline ew-empty-state-action" onClick={() => { setStatusFilter("alle"); setSearch(""); }}>
            Filter zurücksetzen
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {filtered.map(({ inq, d }) => {
        const sc = STATUS_COLORS[inq.status] ?? STATUS_COLORS.neu;
        const isOpen = expanded === inq.id;

        return (
          <div key={inq.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            {/* Row summary */}
            <div
              onClick={() => setExpanded(isOpen ? null : inq.id)}
              style={{ display: "grid", gridTemplateColumns: "1fr 10rem 1fr", alignItems: "center", gap: "0.85rem", padding: "0.9rem 1.5rem", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: "0.9rem", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {d.artTitel || "Retreat"} — {d.nameGruppenleitung}
                </span>
                {inq.eventId && (
                  <span style={{ display: "inline-flex", alignItems: "center", background: "var(--primary-tint)", color: "var(--primary-text)", padding: "0.18rem 0.5rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 600, flexShrink: 0 }}>
                    Inhouse
                  </span>
                )}
              </div>

              <span style={{ display: "inline-flex", alignItems: "center", justifySelf: "start", background: sc.bg, color: sc.color, padding: "0.18rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600, flexShrink: 0 }}>
                {STATUS_LABELS[inq.status] ?? inq.status}
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", justifySelf: "end" }}>
                {inq.holdExpiresAt && (
                  <span style={{ color: "var(--badge-pending-text)", fontSize: "0.72rem", fontWeight: 600, flexShrink: 0 }}>
                    ⏱ {fmtHoldRemaining(inq.holdExpiresAt)}
                  </span>
                )}
                <span style={{ fontSize: "0.78rem", color: "var(--muted)", flexShrink: 0 }}>
                  {d.datumVon ? fmtDate(d.datumVon) : "–"}
                </span>
                <span className="ew-inq-created" style={{ fontSize: "0.75rem", color: "var(--muted)", flexShrink: 0 }}>
                  {fmt(inq.createdAt)}
                </span>
                <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{isOpen ? "▲" : "▼"}</span>
              </div>
            </div>

            {/* Detail panel */}
            {isOpen && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <DetailRow label={inq.eventId ? "Event" : "Veranstaltung"} value={d.artTitel} />
                  <DetailRow label="Raum" value={d.raum ?? ""} />
                  <DetailRow label="Gruppenleitung" value={d.nameGruppenleitung} />
                  <DetailRow label="E-Mail" value={d.email} />
                  <DetailRow label="Anreise" value={d.datumVon && d.zeitVon ? `${fmtDate(d.datumVon)}, ${d.zeitVon} Uhr` : fmtDate(d.datumVon)} />
                  <DetailRow label="Abreise" value={d.datumBis && d.zeitBis ? `${fmtDate(d.datumBis)}, ${d.zeitBis} Uhr` : fmtDate(d.datumBis)} />
                  <DetailRow label="Teilnehmer:innen" value={d.personenAnzahl} />
                  <DetailRow label="Leiter:innen" value={d.leiterinnen} />
                  <DetailRow label="Bestuhlung" value={d.bestuhlung === true ? "Ja" : d.bestuhlung === false ? "Nein" : ""} />
                  <DetailRow label="Tische" value={d.tische === true ? "Ja" : d.tische === false ? "Nein" : ""} />
                  <DetailRow label="Equipment" value={d.sonstigesEquipment} />
                  <DetailRow label="Verpflegung" value={d.verpflegung} />
                  <DetailRow label="Zimmerwunsch" value={d.zimmerwunsch} />
                  <DetailRow label="Rahmenprogramm" value={d.wuenscheRahmenprogramm} />
                  <DetailRow label="Abrechnung" value={d.abrechnung} />
                  {(config.customFields ?? []).map((field) => {
                    const val = d.customFields?.[field.id];
                    const display = Array.isArray(val) ? val.join(", ") : val ?? "";
                    return <DetailRow key={field.id} label={field.label} value={display} />;
                  })}
                  {inq.holdExpiresAt && (
                    <DetailRow
                      label="Frist"
                      value={`${fmtHoldRemaining(inq.holdExpiresAt)} (${new Date(inq.holdExpiresAt).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} Uhr)`}
                    />
                  )}
                </div>

                <InvoicePanel
                  inquiryId={inq.id}
                  inquiryUpdatedAt={inq.updatedAt}
                  participantCount={inq.participantCount}
                  onStatusChange={(newStatus, newUpdatedAt) =>
                    setInquiries((prev) => prev.map((i) => i.id === inq.id ? { ...i, status: newStatus, updatedAt: newUpdatedAt } : i))
                  }
                />

                {/* Status + delete controls */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: "0.9rem" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--muted)", marginRight: "0.25rem" }}>Status:</span>
                  {Object.entries(STATUS_LABELS).filter(([key]) => key !== "abgelaufen").map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setStatus(inq.id, key)}
                      className="ew-admin-btn"
                      style={{
                        border: `1px solid ${inq.status === key ? STATUS_COLORS[key].color : "var(--border)"}`,
                        background: inq.status === key ? STATUS_COLORS[key].bg : "none",
                        color: inq.status === key ? STATUS_COLORS[key].color : "var(--muted)",
                        fontSize: "0.78rem",
                        fontWeight: inq.status === key ? 600 : 400,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    onClick={() => deleteInquiry(inq.id, `${d.artTitel || "Retreat"} — ${d.nameGruppenleitung}`)}
                    className="ew-admin-btn ew-admin-btn-outline-danger"
                    style={{ marginLeft: "auto", fontSize: "0.78rem" }}
                  >
                    Löschen
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
