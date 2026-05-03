"use client";
import { useState, useEffect } from "react";
import type { InquiryFormData } from "@/lib/types";
import InvoicePanel from "@/components/admin/InvoicePanel";

interface Inquiry {
  id: string;
  data: string;
  status: string;
  createdAt: string;
  participantCount: number;
  packageId: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  neu:               "Neu",
  in_pruefung:       "In Prüfung",
  angebot_versendet: "Angebot versendet",
  bestaetigt:        "Bestätigt",
  abgelehnt:         "Abgelehnt",
  storniert:         "Storniert",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  neu:               { bg: "#eff6ff", color: "#1d4ed8" },
  in_pruefung:       { bg: "#fefce8", color: "#a16207" },
  angebot_versendet: { bg: "#f5f3ff", color: "#6d28d9" },
  bestaetigt:        { bg: "#f0fdf4", color: "#15803d" },
  abgelehnt:         { bg: "#fef2f2", color: "#b91c1c" },
  storniert:         { bg: "#f3f4f6", color: "#6b7280" },
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
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

export default function InquiryInbox() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/inquiries")
      .then((r) => r.json())
      .then((data) => { setInquiries(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function setStatus(id: string, status: string) {
    const res = await fetch("/api/admin/inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setInquiries((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    }
  }

  async function deleteInquiry(id: string) {
    const res = await fetch("/api/admin/inquiries", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setInquiries((prev) => prev.filter((i) => i.id !== id));
  }

  if (loading) return <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Lade Anfragen…</p>;
  if (inquiries.length === 0) {
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "2.5rem", textAlign: "center", color: "var(--muted)", fontSize: "0.9rem" }}>
        Noch keine Anfragen eingegangen.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {inquiries.map((inq) => {
        const d = JSON.parse(inq.data) as InquiryFormData;
        const sc = STATUS_COLORS[inq.status] ?? STATUS_COLORS.neu;
        const isOpen = expanded === inq.id;

        return (
          <div key={inq.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            {/* Row summary */}
            <div
              onClick={() => setExpanded(isOpen ? null : inq.id)}
              style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.9rem 1.25rem", cursor: "pointer" }}
            >
              <span style={{ background: sc.bg, color: sc.color, padding: "0.18rem 0.6rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600, flexShrink: 0 }}>
                {STATUS_LABELS[inq.status] ?? inq.status}
              </span>
              <span style={{ fontWeight: 600, fontSize: "0.9rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.artTitel || "Retreat"} — {d.nameGruppenleitung}
              </span>
              <span style={{ fontSize: "0.78rem", color: "var(--muted)", flexShrink: 0 }}>
                {d.datumVon ? fmtDate(d.datumVon) : "–"}
              </span>
              <span className="ew-inq-created" style={{ fontSize: "0.75rem", color: "var(--muted)", flexShrink: 0 }}>
                {fmt(inq.createdAt)}
              </span>
              <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{isOpen ? "▲" : "▼"}</span>
            </div>

            {/* Detail panel */}
            {isOpen && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <DetailRow label="Veranstaltung" value={d.artTitel} />
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
                </div>

                <InvoicePanel
                  inquiryId={inq.id}
                  participantCount={inq.participantCount}
                  onStatusChange={(newStatus) =>
                    setInquiries((prev) => prev.map((i) => i.id === inq.id ? { ...i, status: newStatus } : i))
                  }
                />

                {/* Status + delete controls */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: "0.9rem" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--muted)", marginRight: "0.25rem" }}>Status:</span>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setStatus(inq.id, key)}
                      style={{
                        padding: "0.28rem 0.75rem",
                        border: `1px solid ${inq.status === key ? STATUS_COLORS[key].color : "var(--border)"}`,
                        borderRadius: "var(--radius-sm)",
                        background: inq.status === key ? STATUS_COLORS[key].bg : "none",
                        color: inq.status === key ? STATUS_COLORS[key].color : "var(--muted)",
                        fontSize: "0.78rem",
                        fontWeight: inq.status === key ? 600 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    onClick={() => deleteInquiry(inq.id)}
                    style={{ marginLeft: "auto", padding: "0.28rem 0.65rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", color: "#dc2626", cursor: "pointer", fontSize: "0.78rem" }}
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
  );
}
