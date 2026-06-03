"use client";
import { useFormStore } from "@/store/form";
import type { EventConfig } from "@/lib/types";

interface Props { config: EventConfig }

function show(config: EventConfig, field: keyof NonNullable<EventConfig["formFields"]>) {
  return config.formFields?.[field] !== false;
}

export default function Step2Gruppe({ config }: Props) {
  const { form, setField } = useFormStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "1rem" }}>
        <div className="ew-field">
          <input type="text" placeholder=" " value={form.nameGruppenleitung} onChange={(e) => setField("nameGruppenleitung", e.target.value)} autoFocus />
          <label>Name Gruppenleitung *</label>
        </div>
        <div className="ew-field">
          <input type="email" placeholder=" " value={form.email} onChange={(e) => setField("email", e.target.value)} />
          <label>E-Mail *</label>
        </div>
      </div>

      {show(config, "telefon") && (
        <div className="ew-field">
          <input type="tel" placeholder=" " value={form.telefon} onChange={(e) => setField("telefon", e.target.value)} />
          <label>Telefon</label>
        </div>
      )}

      {(show(config, "personenAnzahl") || show(config, "leiterinnen")) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "1rem" }}>
          {show(config, "personenAnzahl") && (
            <div className="ew-field">
              <input type="text" placeholder=" " value={form.personenAnzahl} onChange={(e) => setField("personenAnzahl", e.target.value)} />
              <label>Anzahl Teilnehmer:innen</label>
            </div>
          )}
          {show(config, "leiterinnen") && (
            <div className="ew-field">
              <input type="text" placeholder=" " value={form.leiterinnen} onChange={(e) => setField("leiterinnen", e.target.value)} />
              <label>Leiter:innen</label>
            </div>
          )}
        </div>
      )}

      {show(config, "sprache") && (
        <div className={`ew-field${form.sprache ? " has-value" : ""}`}>
          <select value={form.sprache} onChange={(e) => setField("sprache", e.target.value)}>
            <option value=""></option>
            <option value="Deutsch">Deutsch</option>
            <option value="Englisch">Englisch</option>
            <option value="Gemischt">Gemischt</option>
            <option value="Andere">Andere</option>
          </select>
          <label>Sprache der Gruppe</label>
        </div>
      )}
    </div>
  );
}
