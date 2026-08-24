"use client";
import { useState, useEffect } from "react";

interface Props {
  slug: string;
}

function EmbedSnippet({ title, description, src, origin, iframeId }: { title: string; description: string; src: string; origin: string; iframeId: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<iframe id="${iframeId}" src="${src}" width="100%" frameborder="0" style="border:none;display:block" scrolling="no"></iframe>
<script src="${origin}/embed.js"><\/script>`;

  function copySnippet() {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <details style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.5rem" }}>
      <summary style={{ cursor: "pointer", fontSize: "0.95rem", fontWeight: 600 }}>{title}</summary>
      <p style={{ margin: "0.75rem 0", fontSize: "0.85rem", color: "var(--muted)" }}>{description}</p>
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
        style={{
          marginTop: "1rem",
          padding: "0.65rem 1.25rem",
          background: copied ? "#16a34a" : "var(--primary)",
          color: "var(--btn-text)",
          border: "none",
          borderRadius: "var(--radius-sm)",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: "0.85rem",
          width: "fit-content",
          transition: "background 0.2s",
        }}
      >
        {copied ? "✓ In der Zwischenablage" : "Code kopieren"}
      </button>
    </details>
  );
}

function FramerSnippet({ origin, slug }: { origin: string; slug: string }) {
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
    });
  }

  return (
    <details style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.5rem" }}>
      <summary style={{ cursor: "pointer", fontSize: "0.95rem", fontWeight: 600 }}>Einbetten in Framer</summary>
      <p style={{ margin: "0.75rem 0", fontSize: "0.85rem", color: "var(--muted)" }}>
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
        style={{
          marginTop: "1rem",
          padding: "0.65rem 1.25rem",
          background: copied ? "#16a34a" : "var(--primary)",
          color: "var(--btn-text)",
          border: "none",
          borderRadius: "var(--radius-sm)",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: "0.85rem",
          width: "fit-content",
          transition: "background 0.2s",
        }}
      >
        {copied ? "✓ In der Zwischenablage" : "Code kopieren"}
      </button>
    </details>
  );
}

export default function EmbedEditor({ slug }: Props) {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <EmbedSnippet
        title="Anfrageformular"
        description="Für Gäste/Gruppen, die selbst eine Veranstaltung bei dir durchführen wollen. Diesen Code in deine Website einfügen (z.B. im HTML-Editor deines CMS):"
        src={`${origin}/?kunde=${slug}`}
        origin={origin}
        iframeId="eventwulf-widget"
      />
      <EmbedSnippet
        title="Events"
        description="Zeigt deine terminierten Events zum direkten Buchen (siehe Admin-Bereich „Events“). Getrennt vom Anfrageformular, kann auf einer eigenen Seite eingebettet werden:"
        src={`${origin}/events?kunde=${slug}`}
        origin={origin}
        iframeId="eventwulf-events-widget"
      />
      <FramerSnippet origin={origin} slug={slug} />
    </div>
  );
}
