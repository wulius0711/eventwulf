"use client";
import { useEffect, useRef, useState } from "react";

// Small "i" next to a label. The text shows on hover (mouse), and opens on tap
// or Enter/Space (touch, keyboard); a tap elsewhere or Escape closes it.
// Styles: .ew-infotip in globals.css.
export default function InfoTip({ text, align = "left" }: { text: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={text}
      aria-expanded={open}
      className={`ew-infotip${align === "right" ? " ew-infotip--right" : ""}${open ? " ew-infotip--open" : ""}`}
      data-tip={text}
      onClick={(e) => {
        e.preventDefault(); // the "i" sits inside a <label>
        setOpen((o) => !o);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((o) => !o);
        }
      }}
    >
      i
    </span>
  );
}
