"use client";
import { ViewTransition } from "react";

// Muss in jeder einzelnen admin/page.tsx sitzen, nicht im gemeinsamen
// Layout – siehe AdminShell.tsx für die Begründung. share/enter="auto"
// lässt React die eingebaute Standard-Überblendung verwenden, ohne
// eigene Keyframes. default="none" verhindert, dass dieser Wrapper bei
// unabhängigen Transitions anderswo auf der Seite mitanimiert.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition name="ew-main" share="auto" enter="auto" default="none">
      {children}
    </ViewTransition>
  );
}
