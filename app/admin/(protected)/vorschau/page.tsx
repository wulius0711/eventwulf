"use client";
import { useRef, useState } from "react";

const MIN_WIDTH = 320;
const MAX_WIDTH = 1200;

export default function VorschauPage() {
  const [width, setWidth] = useState(480);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  function startDrag(side: "left" | "right") {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      startX.current = e.clientX;
      startWidth.current = width;
      setDragging(true);

      function onMove(ev: MouseEvent) {
        if (ev.buttons === 0) { stop(); return; }
        const delta = ev.clientX - startX.current;
        const next = side === "right" ? startWidth.current + delta : startWidth.current - delta;
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)));
      }

      function stop() {
        setDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", stop);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", stop);
    };
  }

  const handleStyle = (side: "left" | "right"): React.CSSProperties => ({
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    [side]: "-20px",
    width: "12px",
    height: "48px",
    borderRadius: "6px",
    background: dragging ? "#6366f1" : "#334155",
    cursor: "ew-resize",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    zIndex: 10,
  });

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      {/* Full-screen drag overlay — blocks iframe from swallowing events */}
      {dragging && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, cursor: "ew-resize" }} />
      )}

      <div className="ew-vorschau-px" style={{ fontSize: "0.78rem", color: "#64748b" }}>{width}px</div>

      <div className="ew-vorschau-device" style={{ position: "relative", width }}>
        <div className="ew-vorschau-handle" style={handleStyle("left")} onMouseDown={startDrag("left")}>
          <div style={{ width: "2px", height: "20px", background: "#94a3b8", borderRadius: "1px", boxShadow: "3px 0 0 #94a3b8" }} />
        </div>

        <div style={{ borderRadius: "10px", overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", border: "1px solid #334155", height: "calc(100vh - 120px)" }}>
          <iframe
            src="/"
            title="Vorschau"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          />
        </div>

        <div className="ew-vorschau-handle" style={handleStyle("right")} onMouseDown={startDrag("right")}>
          <div style={{ width: "2px", height: "20px", background: "#94a3b8", borderRadius: "1px", boxShadow: "3px 0 0 #94a3b8" }} />
        </div>
      </div>
    </div>
  );
}
