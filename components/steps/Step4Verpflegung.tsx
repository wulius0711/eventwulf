"use client";
import { useFormStore } from "@/store/form";
import type { EventConfig } from "@/lib/types";

interface Props { config: EventConfig }

export default function Step4Verpflegung({ config }: Props) {
  const { form, setField } = useFormStore();
  const ff = config.formFields;
  const showVerpflegung = ff?.verpflegung !== false;
  const showZimmerwunsch = ff?.zimmerwunsch !== false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "1rem" }}>
        {showVerpflegung && config.verpflegungOptions?.length > 0 && (
          <div className={`ew-field${form.verpflegung ? " has-value" : ""}`}>
            <select value={form.verpflegung} onChange={(e) => setField("verpflegung", e.target.value)}>
              <option value=""></option>
              {config.verpflegungOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <label>Verpflegung</label>
          </div>
        )}
        {showZimmerwunsch && config.zimmerwunschOptions?.length > 0 && (
          <div className={`ew-field${form.zimmerwunsch ? " has-value" : ""}`}>
            <select value={form.zimmerwunsch} onChange={(e) => setField("zimmerwunsch", e.target.value)}>
              <option value=""></option>
              {config.zimmerwunschOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <label>Zimmerwunsch</label>
          </div>
        )}
      </div>
    </div>
  );
}
