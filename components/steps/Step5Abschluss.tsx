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
        <div>
          <label>Wünsche für Rahmenprogramm</label>
          <textarea rows={4} placeholder="Angebot für Wanderung, Backkurs, Yoga, Meditation, ..." value={form.wuenscheRahmenprogramm} onChange={(e) => setField("wuenscheRahmenprogramm", e.target.value)} style={{ resize: "vertical" }} autoFocus />
        </div>
      )}
      {ff?.abrechnung !== false && config.abrechnungOptions?.length > 0 && (
        <div>
          <label>Abrechnung</label>
          <select value={form.abrechnung} onChange={(e) => setField("abrechnung", e.target.value)}>
            <option value="">Auswählen</option>
            {config.abrechnungOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-5">
        {ff?.zahlung !== false && config.zahlungOptions?.length > 0 && (
          <div>
            <label>Zahlung</label>
            <select value={form.zahlung} onChange={(e) => setField("zahlung", e.target.value)}>
              <option value="">Auswählen</option>
              {config.zahlungOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}

        {show(config, "anreise") && (
          <div>
            <label>Anreise</label>
            <select value={form.anreise} onChange={(e) => setField("anreise", e.target.value)}>
              <option value="">Auswählen</option>
              {(config.anreiseOptions?.length > 0 ? config.anreiseOptions : ["PKW", "Bahn / Öffentliche", "Bus (organisiert)", "Kombination"]).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {show(config, "barrierefreiheit") && (
        <div>
          <label>Besondere Bedürfnisse / Barrierefreiheit</label>
          <textarea rows={3} placeholder="z.B. Rollstuhlzugang, Allergien, sonstige Anforderungen …" value={form.barrierefreiheit} onChange={(e) => setField("barrierefreiheit", e.target.value)} style={{ resize: "vertical" }} />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-5">
        {show(config, "budget") && config.budgetOptions?.length > 0 && (
          <div>
            <label>Budgetrahmen</label>
            <select value={form.budget} onChange={(e) => setField("budget", e.target.value)}>
              <option value="">Auswählen</option>
              {config.budgetOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}

        {show(config, "quelle") && config.quelleOptions?.length > 0 && (
          <div>
            <label>Wie habt ihr uns gefunden?</label>
            <select value={form.quelle} onChange={(e) => setField("quelle", e.target.value)}>
              <option value="">Auswählen</option>
              {config.quelleOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
