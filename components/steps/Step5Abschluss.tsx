"use client";
import { useFormStore } from "@/store/form";
import type { EventConfig } from "@/lib/types";

interface Props { config: EventConfig }

function show(config: EventConfig, field: keyof NonNullable<EventConfig["formFields"]>) {
  return config.formFields?.[field] !== false;
}

export default function Step5Abschluss({ config }: Props) {
  const { form, setField } = useFormStore();
  const ff = config.formFields;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {ff?.wuenscheRahmenprogramm !== false && (
        <div className="ew-field">
          <textarea rows={4} placeholder=" " value={form.wuenscheRahmenprogramm} onChange={(e) => setField("wuenscheRahmenprogramm", e.target.value)} style={{ resize: "vertical" }} autoFocus />
          <label>Wünsche für Rahmenprogramm</label>
        </div>
      )}
      {ff?.abrechnung !== false && config.abrechnungOptions?.length > 0 && (
        <div className={`ew-field${form.abrechnung ? " has-value" : ""}`}>
          <select value={form.abrechnung} onChange={(e) => setField("abrechnung", e.target.value)}>
            <option value=""></option>
            {config.abrechnungOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <label>Abrechnung</label>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "1rem" }}>
        {ff?.zahlung !== false && config.zahlungOptions?.length > 0 && (
          <div className={`ew-field${form.zahlung ? " has-value" : ""}`}>
            <select value={form.zahlung} onChange={(e) => setField("zahlung", e.target.value)}>
              <option value=""></option>
              {config.zahlungOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <label>Zahlung</label>
          </div>
        )}
        {show(config, "anreise") && (
          <div className={`ew-field${form.anreise ? " has-value" : ""}`}>
            <select value={form.anreise} onChange={(e) => setField("anreise", e.target.value)}>
              <option value=""></option>
              {(config.anreiseOptions?.length > 0 ? config.anreiseOptions : ["PKW", "Bahn / Öffentliche", "Bus (organisiert)", "Kombination"]).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <label>Anreise</label>
          </div>
        )}
      </div>

      {show(config, "barrierefreiheit") && (
        <div className="ew-field">
          <textarea rows={3} placeholder=" " value={form.barrierefreiheit} onChange={(e) => setField("barrierefreiheit", e.target.value)} style={{ resize: "vertical" }} />
          <label>Besondere Bedürfnisse / Barrierefreiheit</label>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "1rem" }}>
        {show(config, "budget") && config.budgetOptions?.length > 0 && (
          <div className={`ew-field${form.budget ? " has-value" : ""}`}>
            <select value={form.budget} onChange={(e) => setField("budget", e.target.value)}>
              <option value=""></option>
              {config.budgetOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <label>Budgetrahmen</label>
          </div>
        )}
        {show(config, "quelle") && config.quelleOptions?.length > 0 && (
          <div className={`ew-field${form.quelle ? " has-value" : ""}`}>
            <select value={form.quelle} onChange={(e) => setField("quelle", e.target.value)}>
              <option value=""></option>
              {config.quelleOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <label>Wie habt ihr uns gefunden?</label>
          </div>
        )}
      </div>
    </div>
  );
}
