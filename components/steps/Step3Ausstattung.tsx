"use client";
import { useFormStore } from "@/store/form";
import CustomFieldsSection from "@/components/CustomFieldsSection";
import type { PublicWidgetConfig } from "@/lib/types";

interface Props { config: PublicWidgetConfig }

export default function Step3Ausstattung({ config }: Props) {
  const { form, setField } = useFormStore();
  const ff = config.formFields;
  const showEquipment = ff?.sonstigesEquipment !== false;

  return (
    <div className="ew-step-body">
      {config.ausstattungOptions?.length > 0 && (
        <div className="ew-checkbox-grid">
          {config.ausstattungOptions.map((opt) => {
            const checked = form.ausstattungExtra.includes(opt);
            return (
              <label key={opt} className="ew-checkbox-option" data-checked={checked ? "" : undefined}>
                <input type="checkbox" checked={checked} style={{ accentColor: "var(--primary)" }} onChange={() => { const next = checked ? form.ausstattungExtra.filter((x) => x !== opt) : [...form.ausstattungExtra, opt]; setField("ausstattungExtra", next); }} />
                <span className="ew-checkbox-option-label">{opt}</span>
              </label>
            );
          })}
        </div>
      )}
      {showEquipment && (
        <div className="ew-field">
          <textarea rows={4} placeholder=" " value={form.sonstigesEquipment} onChange={(e) => setField("sonstigesEquipment", e.target.value)} />
          <label>Sonstiges Equipment</label>
        </div>
      )}
      <CustomFieldsSection config={config} step={3} />
    </div>
  );
}
