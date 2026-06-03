"use client";
import { useFormStore } from "@/store/form";
import type { EventConfig } from "@/lib/types";

interface Props { config: EventConfig }

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
                <input type="checkbox" checked={checked} onChange={() => { const next = checked ? form.ausstattungExtra.filter((x) => x !== opt) : [...form.ausstattungExtra, opt]; setField("ausstattungExtra", next); }} />
                {opt}
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
    </div>
  );
}
