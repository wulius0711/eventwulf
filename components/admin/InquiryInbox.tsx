"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { EventConfig, InquiryFormData } from "@/lib/types";
import InvoicePanel from "@/components/admin/InvoicePanel";
import { useToast } from "@/components/admin/Toast";
import { InboxEmptyIcon, FilterEmptyIcon, ArchiveIcon } from "@/components/admin/icons";

interface Inquiry {
  id: string;
  data: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
  eventId: string | null;
  holdExpiresAt: string | null;
  archivedAt: string | null;
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

const PAGE_SIZES = [20, 50, 100];
const PAGE_SIZE_KEY = "ew-admin-inquiries-pagesize";

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const deepLinkId = searchParams.get("id");
  const hadUrlParams = !!(searchParams.get("id") || searchParams.get("status"));
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Deep-linked from the dashboard's "Offene Anfragen" card, e.g.
  // ?status=neu — read once on mount, same as deepLinkId below.
  const [statusFilter, setStatusFilter] = useState(() => {
    const s = searchParams.get("status");
    return s && STATUS_GROUPS.some((g) => g.key === s) ? s : "alle";
  });
  const [view, setView] = useState<"inbox" | "archiv">("inbox");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageSize, setPageSize] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(PAGE_SIZE_KEY));
      return PAGE_SIZES.includes(stored) ? stored : 20;
    } catch { return 20; }
  });

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    try { localStorage.setItem(PAGE_SIZE_KEY, String(pageSize)); } catch {}
  }, [pageSize]);

  function buildParams(skip: number) {
    const params = new URLSearchParams();
    params.set("archived", view === "archiv" ? "true" : "false");
    const activeGroup = STATUS_GROUPS.find((g) => g.key === statusFilter);
    if (activeGroup?.statuses) params.set("statuses", activeGroup.statuses.join(","));
    // A search spans the full matching history, not just one loaded page —
    // `data` is opaque JSON text (no server-side text search), so this
    // fetches everything for the current status/archiv filter and searches
    // client-side below, instead of paginating while a search is active.
    if (!search.trim()) {
      params.set("take", String(pageSize));
      params.set("skip", String(skip));
    }
    return params;
  }

  // Reset to the first page whenever the filter itself changes.
  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/inquiries?${buildParams(0)}`)
      .then((r) => r.json())
      .then(async (res: { inquiries: Inquiry[]; total: number }) => {
        let list = res.inquiries;
        let listTotal = res.total;
        // Deep-link from e.g. the dashboard's "Neueste Anfragen" list — the
        // target might not be on this filter's first page (or even this
        // filter at all), so fetch it directly and splice it in rather than
        // trusting it showed up in the normal load.
        if (deepLinkId && !list.some((i) => i.id === deepLinkId)) {
          const single = await fetch(`/api/admin/inquiries?id=${encodeURIComponent(deepLinkId)}`).then((r) => r.json()).catch(() => null);
          if (single?.inquiries?.[0]) {
            list = [single.inquiries[0], ...list];
            listTotal += 1;
          }
        }
        setInquiries(list);
        setTotal(listTotal);
        setLoading(false);
        if (deepLinkId && list.some((i) => i.id === deepLinkId)) {
          setExpanded(deepLinkId);
          router.replace("/admin/inquiries");
          requestAnimationFrame(() => {
            document.getElementById(`inquiry-row-${deepLinkId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        } else {
          setExpanded(null);
          // ?status=neu (no matching id) was consumed into statusFilter's
          // initial state above — drop it from the URL now that it's applied.
          if (hadUrlParams) router.replace("/admin/inquiries");
        }
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, statusFilter, pageSize, debouncedSearch]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/admin/inquiries?${buildParams(inquiries.length)}`);
      const data = await res.json() as { inquiries: Inquiry[]; total: number };
      setInquiries((prev) => [...prev, ...data.inquiries]);
      setTotal(data.total);
    } finally {
      setLoadingMore(false);
    }
  }

  // After a status/archive change, an inquiry that no longer matches the
  // current view (e.g. archived while viewing the inbox) is dropped from the
  // list instead of lingering until the next full reload.
  function applyUpdate(id: string, patch: Partial<Inquiry>) {
    setInquiries((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx === -1) return prev;
      const merged = { ...prev[idx], ...patch };
      const archivedOk = view === "archiv" ? merged.archivedAt !== null : merged.archivedAt === null;
      const activeGroup = STATUS_GROUPS.find((g) => g.key === statusFilter);
      const statusOk = !activeGroup?.statuses || activeGroup.statuses.includes(merged.status);
      if (!archivedOk || !statusOk) {
        setTotal((t) => Math.max(0, t - 1));
        return prev.filter((i) => i.id !== id);
      }
      return prev.map((i) => (i.id === id ? merged : i));
    });
  }

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
      applyUpdate(id, { status: updated.status, updatedAt: updated.updatedAt });
      showToast("success", "Status aktualisiert");
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string };
      showToast("error", d.error ?? "Fehler beim Ändern des Status");
    }
  }

  async function setArchived(id: string, archived: boolean) {
    const res = await fetch("/api/admin/inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, archived }),
    });
    if (res.ok) {
      const updated = await res.json() as Inquiry;
      applyUpdate(id, { archivedAt: updated.archivedAt });
      showToast("success", archived ? "Anfrage archiviert" : "Aus Archiv geholt");
    } else {
      showToast("error", "Fehler beim Archivieren");
    }
  }

  async function deleteInquiry(id: string, label: string) {
    if (!window.confirm(`Anfrage „${label}" wirklich löschen?`)) return;
    const res = await fetch("/api/admin/inquiries", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setInquiries((prev) => prev.filter((i) => i.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      showToast("success", "Anfrage gelöscht");
    } else {
      showToast("error", "Fehler beim Löschen");
    }
  }

  if (loading) return <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Lade Anfragen…</p>;

  const isUnfiltered = view === "inbox" && statusFilter === "alle" && !search.trim();
  if (inquiries.length === 0 && isUnfiltered) {
    return (
      <div className="ew-empty-state">
        <span className="ew-empty-state-icon">{InboxEmptyIcon}</span>
        <div className="ew-empty-state-title">Noch keine Anfragen</div>
        <p className="ew-empty-state-body">Hier erscheinen Anfragen, sobald jemand über dein Buchungswidget anfragt.</p>
      </div>
    );
  }

  const parsed = inquiries.map((inq) => ({ inq, d: JSON.parse(inq.data) as InquiryFormData }));
  const filtered = search.trim()
    ? parsed.filter(({ d }) => {
        const haystack = `${d.artTitel ?? ""} ${d.nameGruppenleitung ?? ""} ${d.email ?? ""}`.toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
      })
    : parsed;
  const canLoadMore = !search.trim() && inquiries.length < total;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="ew-inq-filterbar" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
          {STATUS_GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => { setStatusFilter(g.key); setView("inbox"); }}
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
          <button
            type="button"
            onClick={() => setView(view === "archiv" ? "inbox" : "archiv")}
            title="Archivierte Anfragen anzeigen"
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.35rem",
              padding: "0.35rem 0.85rem", borderRadius: "999px", fontSize: "0.8rem", fontWeight: 600,
              marginLeft: "0.5rem",
              border: `1px solid ${view === "archiv" ? "var(--primary)" : "var(--border)"}`,
              background: view === "archiv" ? "var(--primary-tint)" : "none",
              color: view === "archiv" ? "var(--primary-text)" : "var(--muted)",
              cursor: "pointer",
            }}
          >
            {ArchiveIcon} Archiv
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nach Titel, Name oder E-Mail filtern…"
            style={{ width: "auto", minWidth: "300px" }}
          />
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ width: "auto" }} title="Anzahl pro Seite">
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} pro Seite</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="ew-empty-state">
          <span className="ew-empty-state-icon">{FilterEmptyIcon}</span>
          <div className="ew-empty-state-title">Keine Treffer</div>
          <p className="ew-empty-state-body">
            Für „{view === "archiv" ? "Archiv" : STATUS_GROUPS.find((g) => g.key === statusFilter)?.label}"{search.trim() ? ` und „${search}"` : ""} wurde nichts gefunden.
          </p>
          <button type="button" className="ew-admin-btn ew-admin-btn-outline ew-empty-state-action" onClick={() => { setStatusFilter("alle"); setView("inbox"); setSearch(""); }}>
            Filter zurücksetzen
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {filtered.map(({ inq, d }) => {
        const sc = STATUS_COLORS[inq.status] ?? STATUS_COLORS.neu;
        const isOpen = expanded === inq.id;
        const isArchived = inq.archivedAt !== null;

        return (
          <div key={inq.id} id={`inquiry-row-${inq.id}`} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
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
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setArchived(inq.id, !isArchived); }}
                  title={isArchived ? "Aus Archiv holen" : "Archivieren"}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: "1.6rem", height: "1.6rem", padding: 0, border: "none", borderRadius: "var(--radius-sm)",
                    background: "none", color: isArchived ? "var(--primary-text)" : "var(--muted)", cursor: "pointer", flexShrink: 0,
                  }}
                >
                  {ArchiveIcon}
                </button>
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
                  {isArchived && inq.archivedAt && (
                    <DetailRow label="Archiviert" value={new Date(inq.archivedAt).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" })} />
                  )}
                </div>

                <InvoicePanel
                  inquiryId={inq.id}
                  inquiryUpdatedAt={inq.updatedAt}
                  participantCount={inq.participantCount}
                  onStatusChange={(newStatus, newUpdatedAt) => applyUpdate(inq.id, { status: newStatus, updatedAt: newUpdatedAt })}
                />

                {/* Status + archive + delete controls */}
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
                  <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => setArchived(inq.id, !isArchived)}
                      className="ew-admin-btn ew-admin-btn-outline"
                      style={{ fontSize: "0.78rem" }}
                    >
                      {isArchived ? "Aus Archiv holen" : "Archivieren"}
                    </button>
                    <button
                      onClick={() => deleteInquiry(inq.id, `${d.artTitel || "Retreat"} — ${d.nameGruppenleitung}`)}
                      className="ew-admin-btn ew-admin-btn-outline-danger"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>

      {canLoadMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="ew-admin-btn ew-admin-btn-outline"
          style={{ alignSelf: "center", fontSize: "0.85rem" }}
        >
          {loadingMore ? "Lädt…" : `Weitere laden (${inquiries.length} von ${total})`}
        </button>
      )}
    </div>
  );
}
