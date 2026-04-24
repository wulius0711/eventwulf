"use client";
import { useFormStore } from "@/store/form";
import type { YogaConfig } from "@/lib/types";

interface Props { config: YogaConfig }

function show(config: YogaConfig, field: keyof NonNullable<YogaConfig["formFields"]>) {
  return config.formFields?.[field] !== false;
}

export default function Step5Abschluss({ config }: Props) {
  const { form, setField } = useFormStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <label>Wünsche für Rahmenprogramm</label>
        <textarea rows={4} placeholder="Angebot für Wanderung, Backkurs, Yoga, Meditation, ..." value={form.wuenscheRahmenprogramm} onChange={(e) => setField("wuenscheRahmenprogramm", e.target.value)} style={{ resize: "vertical" }} autoFocus />
      </div>
      <div>
        <label>Abrechnung</label>
        <select value={form.abrechnung} onChange={(e) => setField("abrechnung", e.target.value)}>
          <option value="">Auswählen</option>
          {config.abrechnungOptions.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {show(config, "anreise") && (
        <div>
          <label>Anreise</label>
          <select value={form.anreise} onChange={(e) => setField("anreise", e.target.value)}>
            <option value="">Auswählen</option>
            <option value="PKW">PKW</option>
            <option value="Bahn / Öffentliche">Bahn / Öffentliche</option>
            <option value="Bus">Bus (organisiert)</option>
            <option value="Kombination">Kombination</option>
          </select>
        </div>
      )}

      {show(config, "barrierefreiheit") && (
        <div>
          <label>Besondere Bedürfnisse / Barrierefreiheit</label>
          <textarea rows={3} placeholder="z.B. Rollstuhlzugang, Allergien, sonstige Anforderungen …" value={form.barrierefreiheit} onChange={(e) => setField("barrierefreiheit", e.target.value)} style={{ resize: "vertical" }} />
        </div>
      )}

      {show(config, "budget") && (
        <div>
          <label>Budgetrahmen</label>
          <select value={form.budget} onChange={(e) => setField("budget", e.target.value)}>
            <option value="">Auswählen</option>
            <option value="unter 500 €">unter 500 €</option>
            <option value="500 – 2.000 €">500 – 2.000 €</option>
            <option value="2.000 – 5.000 €">2.000 – 5.000 €</option>
            <option value="über 5.000 €">über 5.000 €</option>
          </select>
        </div>
      )}

      {show(config, "quelle") && (
        <div>
          <label>Wie habt ihr uns gefunden?</label>
          <select value={form.quelle} onChange={(e) => setField("quelle", e.target.value)}>
            <option value="">Auswählen</option>
            <option value="Google">Google</option>
            <option value="Instagram">Instagram</option>
            <option value="Empfehlung">Empfehlung</option>
            <option value="Facebook">Facebook</option>
            <option value="Messe / Veranstaltung">Messe / Veranstaltung</option>
            <option value="Sonstiges">Sonstiges</option>
          </select>
        </div>
      )}
    </div>
  );
}
