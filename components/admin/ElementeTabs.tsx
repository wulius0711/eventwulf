"use client";
import { useState } from "react";
import type { EventConfig } from "@/lib/types";
import type { Plan } from "@/lib/plan";
import FormularEditor from "@/components/admin/FormularEditor";
import EventsEditor from "@/components/admin/EventsEditor";
import RoomsEditor from "@/components/admin/RoomsEditor";
import AvailabilityEditor from "@/components/admin/AvailabilityEditor";

interface Props {
  initialConfig: EventConfig;
  plan: Plan | null;
}

type Tab = "formular" | "events" | "raeume" | "sperrzeiten";

export default function ElementeTabs({ initialConfig, plan }: Props) {
  const [tab, setTab] = useState<Tab>("formular");

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
      <div
        className="config-tabs"
        style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem", gap: "0.25rem" }}
      >
        <button style={tabStyle("formular")} onClick={() => setTab("formular")}>Formular</button>
        <button style={tabStyle("raeume")} onClick={() => setTab("raeume")}>Räume</button>
        <button style={tabStyle("events")} onClick={() => setTab("events")}>Events</button>
        <button style={tabStyle("sperrzeiten")} onClick={() => setTab("sperrzeiten")}>Sperrzeiten</button>
      </div>

      {tab === "formular" && <FormularEditor initialConfig={initialConfig} plan={plan} />}
      {tab === "raeume" && <RoomsEditor />}
      {tab === "events" && <EventsEditor />}
      {tab === "sperrzeiten" && <AvailabilityEditor />}
    </div>
  );
}
