"use client";
import { useFormStore } from "@/store/form";
import type { EventConfig } from "@/lib/types";

interface Props { config: EventConfig }

export default function Step3Ausstattung({ config }: Props) {
  const { form, setField } = useFormStore();
  const ff = config.formFields;
  const showEquipment = ff?.sonstigesEquipment !== false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {config.ausstattungOptions?.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.5rem" }}>
          {config.ausstattungOptions.map((opt) => {
            const checked = form.ausstattungExtra.includes(opt);
            return (
              <label key={opt} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", border: `1px solid ${checked ? "var(--primary)" : "var(--border)"}`, borderRadius: "var(--radius-sm)", background: checked ? "var(--primary-tint)" : "var(--surface)", cursor: "pointer", fontSize: "0.9rem", fontWeight: checked ? 500 : 400 }}>
                <input type="checkbox" checked={checked} onChange={() => { const next = checked ? form.ausstattungExtra.filter((x) => x !== opt) : [...form.ausstattungExtra, opt]; setField("ausstattungExtra", next); }} style={{ width: "auto" }} />
                {opt}
              </label>
            );
          })}
        </div>
      )}
      {showEquipment && (
        <div>
          <label>Sonstiges Equipment</label>
          <textarea rows={4} placeholder="bspw. Sonderwünsche, besondere Anforderungen …" value={form.sonstigesEquipment} onChange={(e) => setField("sonstigesEquipment", e.target.value)} style={{ resize: "vertical" }} />
        </div>
      )}
    </div>
  );
}
