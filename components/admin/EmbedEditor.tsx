"use client";
import { useState, useEffect } from "react";
import { useToast } from "@/components/admin/Toast";

interface Props {
  slug: string;
}

// Collapsible card. The whole header row is the click target (full width, 1rem
// padding) and shows a small ▸/▾ like the other collapsible sections in the admin.
function EmbedCard({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
    >
      <summary
        style={{
          cursor: "pointer", listStyle: "none", padding: "1rem 1.5rem",
          fontSize: "0.95rem", fontWeight: 600, color: "var(--text)",
          borderBottom: open ? "1px solid var(--border)" : "none",
        }}
      >
        {open ? "▾" : "▸"} {title}
      </summary>
      <div style={{ padding: "1.5rem" }}>{children}</div>
    </details>
  );
}

function EmbedSnippet({ title, description, src, origin, iframeId, extra }: { title: string; description: string; src: string; origin: string; iframeId: string; extra?: React.ReactNode }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const snippet = `<iframe id="${iframeId}" src="${src}" width="100%" frameborder="0" style="border:none;display:block" scrolling="no"></iframe>
<script src="${origin}/embed.js"><\/script>`;

  function copySnippet() {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      showToast("success", "In die Zwischenablage kopiert");
    });
  }

  return (
    <EmbedCard title={title}>
      <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "var(--muted)" }}>{description}</p>
      {extra}
      <textarea
        readOnly
        value={snippet}
        rows={6}
        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        style={{ width: "100%", fontFamily: "monospace", fontSize: "0.78rem", resize: "vertical", background: "var(--bg2)", color: "var(--text)", wordBreak: "break-all", overflowWrap: "break-word" }}
      />
      <button
        type="button"
        onClick={copySnippet}
        className="ew-admin-btn ew-admin-btn-primary"
        style={{
          marginTop: "1rem",
          background: copied ? "#16a34a" : undefined,
          color: copied ? "var(--btn-text)" : undefined,
          fontSize: "0.85rem",
          width: "fit-content",
          transition: "background 0.2s",
        }}
      >
        {copied ? "✓ In der Zwischenablage" : "Code kopieren"}
      </button>
    </EmbedCard>
  );
}

function FramerSnippet({ origin, slug }: { origin: string; slug: string }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const code = `import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

const BASE_URL = "${origin}"

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 */
export default function EventwulfWidget(props) {
    const { slug, widget } = props
    const iframeRef = useRef(null)
    const [height, setHeight] = useState(400)

    const path = widget === "events" ? "/events" : "/"
    const src = \`\${BASE_URL}\${path}?kunde=\${encodeURIComponent(slug || "default")}\`

    useEffect(() => {
        function handleMessage(e) {
            if (!e.data || e.data.type !== "eventwulf-resize") return
            if (e.source !== iframeRef.current?.contentWindow) return
            if (e.data.height) setHeight(e.data.height)
        }
        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [])

    return (
        <iframe
            ref={iframeRef}
            src={src}
            width="100%"
            height={height}
            style={{ border: "none", display: "block", width: "100%", height }}
            scrolling="no"
        />
    )
}

addPropertyControls(EventwulfWidget, {
    slug: {
        type: ControlType.String,
        title: "Kunde-Slug",
        defaultValue: "${slug}",
    },
    widget: {
        type: ControlType.Enum,
        title: "Widget",
        options: ["form", "events"],
        optionTitles: ["Anfrageformular", "Events"],
        defaultValue: "form",
    },
})`;

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      showToast("success", "In die Zwischenablage kopiert");
    });
  }

  return (
    <EmbedCard title="Einbetten in Framer">
      <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "var(--muted)" }}>
        Framer verpackt den HTML-Code oben in ein eigenes iFrame, wodurch die automatische Höhenanpassung dort nicht funktioniert. Lege stattdessen eine <strong>Code Component</strong> an (Assets → Code → + → New Code File), füge diesen Code ein und ziehe die Component danach aus dem Insert-Panel auf deine Seite. Die Component musst du nur <strong>einmal</strong> anlegen — willst du Formular und Events auf derselben oder auf getrennten Seiten zeigen, ziehst du sie einfach zweimal auf die Seite(n) und stellst bei der zweiten Instanz die Property „Widget" auf „Events":
      </p>
      <textarea
        readOnly
        value={code}
        rows={10}
        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        style={{ width: "100%", fontFamily: "monospace", fontSize: "0.75rem", resize: "vertical", background: "var(--bg2)", color: "var(--text)", wordBreak: "break-all", overflowWrap: "break-word" }}
      />
      <button
        type="button"
        onClick={copyCode}
        className="ew-admin-btn ew-admin-btn-primary"
        style={{
          marginTop: "1rem",
          background: copied ? "#16a34a" : undefined,
          color: copied ? "var(--btn-text)" : undefined,
          fontSize: "0.85rem",
          width: "fit-content",
          transition: "background 0.2s",
        }}
      >
        {copied ? "✓ In der Zwischenablage" : "Code kopieren"}
      </button>
    </EmbedCard>
  );
}

interface RoomOption { id: string; name: string; isActive: boolean }

// Lets an admin generate several "Anfrageformular" embeds that each only
// offer a subset of rooms (e.g. one per landing page — "Hochzeiten",
// "Seminare") via an optional `raeume=id1,id2` query param, instead of a
// whole separate config/variant per page. Selecting none or all rooms just
// omits the param (equivalent to "all rooms"), so the default/simple case
// still produces the plain URL from before.
function RoomFilterPicker({ rooms, selected, onToggle }: { rooms: RoomOption[]; selected: Set<string>; onToggle: (id: string) => void }) {
  return (
    <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "var(--bg2)", borderRadius: "var(--radius-sm)" }}>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.82rem", fontWeight: 600, color: "var(--text)" }}>
        Nur bestimmte Räume in diesem Code anbieten (optional)
      </p>
      <p style={{ margin: "0 0 0.6rem", fontSize: "0.78rem", color: "var(--muted)" }}>
        Nichts ausgewählt = alle Räume. Praktisch, wenn du z.B. für „Hochzeiten“ und „Seminare“ eigene Seiten mit jeweils passenden Räumen hast.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {rooms.map((r) => (
          <label key={r.id} className="ew-checkbox-option" data-checked={selected.has(r.id) ? "" : undefined} style={{ fontSize: "0.82rem" }}>
            <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggle(r.id)} style={{ accentColor: "var(--primary)" }} />
            <span className="ew-checkbox-option-label">{r.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function EmbedEditor({ slug }: Props) {
  const [origin, setOrigin] = useState("");
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  // Prefer the fixed production domain over window.location.origin — an
  // admin who happens to be logged in via the *.vercel.app alias instead of
  // app.eventwulf.at would otherwise generate embed snippets pointing
  // customer sites at the wrong domain.
  useEffect(() => { setOrigin(process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin); }, []);

  useEffect(() => {
    fetch("/api/admin/rooms")
      .then((r) => r.json())
      .then((data) => setRooms((data.rooms ?? []).filter((r: RoomOption) => r.isActive)))
      .catch(() => {});
  }, []);

  function toggleRoom(id: string) {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const roomParam = selectedRoomIds.size > 0 && selectedRoomIds.size < rooms.length
    ? `&raeume=${[...selectedRoomIds].join(",")}`
    : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <EmbedSnippet
        title="Anfrageformular"
        description="Für Gäste/Gruppen, die selbst eine Veranstaltung bei dir durchführen wollen. Diesen Code in deine Website einfügen (z.B. im HTML-Editor deines CMS):"
        src={`${origin}/?kunde=${slug}${roomParam}`}
        origin={origin}
        iframeId="eventwulf-widget"
        extra={rooms.length > 1 ? <RoomFilterPicker rooms={rooms} selected={selectedRoomIds} onToggle={toggleRoom} /> : undefined}
      />
      <EmbedSnippet
        title="Events"
        description="Zeigt deine terminierten Events zum direkten Anfragen (siehe Admin-Bereich „Events“). Getrennt vom Anfrageformular, kann auf einer eigenen Seite eingebettet werden:"
        src={`${origin}/events?kunde=${slug}`}
        origin={origin}
        iframeId="eventwulf-events-widget"
      />
      <FramerSnippet origin={origin} slug={slug} />
    </div>
  );
}
