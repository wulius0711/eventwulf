"use client";
import { useFormStore } from "@/store/form";
import type { YogaConfig } from "@/lib/types";

interface Props { config: YogaConfig }

function show(config: YogaConfig, field: keyof NonNullable<YogaConfig["formFields"]>) {
  return config.formFields?.[field] !== false;
}

export default function Step2Gruppe({ config }: Props) {
  const { form, setField } = useFormStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label>Name Gruppenleitung *</label>
          <input type="text" value={form.nameGruppenleitung} onChange={(e) => setField("nameGruppenleitung", e.target.value)} autoFocus />
        </div>
        <div>
          <label>E-Mail *</label>
          <input type="email" placeholder="E-Mail Adresse" value={form.email} onChange={(e) => setField("email", e.target.value)} />
        </div>
      </div>

      {show(config, "telefon") && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label>Telefon</label>
            <input type="tel" placeholder="+43 …" value={form.telefon} onChange={(e) => setField("telefon", e.target.value)} />
          </div>
          <div />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label>Anzahl Teilnehmer:innen</label>
          <input type="text" placeholder="z.B. 12" value={form.personenAnzahl} onChange={(e) => setField("personenAnzahl", e.target.value)} />
        </div>
        <div>
          <label>Leiter:innen</label>
          <input type="text" placeholder="Namen der Kursleiter:innen" value={form.leiterinnen} onChange={(e) => setField("leiterinnen", e.target.value)} />
        </div>
      </div>

      {show(config, "sprache") && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label>Sprache der Gruppe</label>
            <select value={form.sprache} onChange={(e) => setField("sprache", e.target.value)}>
              <option value="">Auswählen</option>
              <option value="Deutsch">Deutsch</option>
              <option value="Englisch">Englisch</option>
              <option value="Gemischt">Gemischt</option>
              <option value="Andere">Andere</option>
            </select>
          </div>
          <div />
        </div>
      )}
    </div>
  );
}
