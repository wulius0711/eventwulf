"use client";
import { useFormStore } from "@/store/form";
import type { YogaConfig } from "@/lib/types";

interface Props { config: YogaConfig }

function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div>
      <label>{label}</label>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {(["Ja", "Nein"] as const).map((opt) => {
          const val = opt === "Ja";
          const active = value === val;
          return (
            <button key={opt} type="button" onClick={() => onChange(val)} style={{ flex: 1, padding: "0.65rem", border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`, borderRadius: "var(--radius-sm)", background: active ? "var(--primary-tint)" : "var(--surface)", color: active ? "var(--primary)" : "var(--muted)", fontWeight: active ? 600 : 400, cursor: "pointer", fontSize: "0.9rem", transition: "all 0.15s" }}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Step3Ausstattung({ config }: Props) {
  const { form, setField } = useFormStore();
  const ff = config.formFields;
  const showBestuhlung = ff?.bestuhlung !== false;
  const showTische = ff?.tische !== false;
  const showBeamer = ff?.beamer !== false;
  const showSoundanlage = ff?.soundanlage !== false;
  const showAussenbereich = ff?.aussenbereich !== false;
  const showEquipment = ff?.sonstigesEquipment !== false;

  const anyYesNo = showBestuhlung || showTische || showBeamer || showSoundanlage || showAussenbereich;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {anyYesNo && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "1rem" }}>
          {showBestuhlung && <YesNo label="Bestuhlung" value={form.bestuhlung} onChange={(v) => setField("bestuhlung", v)} />}
          {showTische && <YesNo label="Tische" value={form.tische} onChange={(v) => setField("tische", v)} />}
          {showBeamer && <YesNo label="Beamer / Projektor" value={form.beamer} onChange={(v) => setField("beamer", v)} />}
          {showSoundanlage && <YesNo label="Soundanlage / Mikrofon" value={form.soundanlage} onChange={(v) => setField("soundanlage", v)} />}
          {showAussenbereich && <YesNo label="Außenbereich" value={form.aussenbereich} onChange={(v) => setField("aussenbereich", v)} />}
        </div>
      )}
      {showEquipment && (
        <div>
          <label>Sonstiges Equipment</label>
          <textarea rows={4} placeholder="bspw. Flipchart, Beamer, Yogamatten, Meditationskissen, ..." value={form.sonstigesEquipment} onChange={(e) => setField("sonstigesEquipment", e.target.value)} style={{ resize: "vertical" }} />
        </div>
      )}
    </div>
  );
}
