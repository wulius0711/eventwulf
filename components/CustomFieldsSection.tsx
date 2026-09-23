"use client";
import { useFormStore } from "@/store/form";
import type { CustomField, EventConfig } from "@/lib/types";

interface Props {
  config: EventConfig;
  step: 1 | 2 | 3 | 4 | 5;
}

function CustomFieldInput({ field }: { field: CustomField }) {
  const { form, setCustomField } = useFormStore();
  const value = form.customFields[field.id];

  if (field.type === "checkboxGroup") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", fontWeight: 500, color: "var(--text)" }}>
          {field.label}
          {field.required && " *"}
        </p>
        <div className="ew-checkbox-grid">
          {(field.options ?? []).map((opt) => {
            const checked = selected.includes(opt);
            return (
              <label key={opt} className="ew-checkbox-option" data-checked={checked ? "" : undefined}>
                <input
                  type="checkbox"
                  checked={checked}
                  style={{ accentColor: "var(--primary)" }}
                  onChange={() => {
                    const next = checked ? selected.filter((o) => o !== opt) : [...selected, opt];
                    setCustomField(field.id, next);
                  }}
                />
                <span className="ew-checkbox-option-label">{opt}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  const strValue = typeof value === "string" ? value : "";

  if (field.type === "textarea") {
    return (
      <div className="ew-field">
        <textarea rows={3} placeholder=" " value={strValue} onChange={(e) => setCustomField(field.id, e.target.value)} style={{ resize: "vertical" }} />
        <label>{field.label}{field.required && " *"}</label>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className={`ew-field${strValue ? " has-value" : ""}`}>
        <select value={strValue} onChange={(e) => setCustomField(field.id, e.target.value)}>
          <option value=""></option>
          {(field.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <label>{field.label}{field.required && " *"}</label>
      </div>
    );
  }

  return (
    <div className="ew-field">
      <input
        type={field.type === "number" ? "number" : "text"}
        placeholder=" "
        value={strValue}
        onChange={(e) => setCustomField(field.id, e.target.value)}
      />
      <label>{field.label}{field.required && " *"}</label>
    </div>
  );
}

export default function CustomFieldsSection({ config, step }: Props) {
  const fields = (config.customFields ?? []).filter((f) => f.step === step);
  if (fields.length === 0) return null;

  // Consecutive fields sharing the same groupLabel render under one shared
  // heading instead of each getting its own — e.g. a checkboxGroup plus a
  // free-text field the admin wants visually clustered together.
  const groups: { groupLabel?: string; fields: CustomField[] }[] = [];
  for (const field of fields) {
    const last = groups[groups.length - 1];
    if (last && last.groupLabel === field.groupLabel && field.groupLabel) {
      last.fields.push(field);
    } else {
      groups.push({ groupLabel: field.groupLabel, fields: [field] });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {groups.map((group, gi) => (
        <div key={gi} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {group.groupLabel && (
            <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>{group.groupLabel}</p>
          )}
          {group.fields.map((field) => <CustomFieldInput key={field.id} field={field} />)}
        </div>
      ))}
    </div>
  );
}
