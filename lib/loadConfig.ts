import fs from "fs";
import path from "path";
import type { EventConfig } from "@/lib/types";

const CLIENTS_DIR = path.join(process.cwd(), "config", "clients");

const ARRAY_DEFAULTS: Partial<EventConfig> = {
  ausstattungOptions: ["Bestuhlung", "Tische", "Beamer / Projektor", "Soundanlage / Mikrofon", "Außenbereich", "Flipchart", "Whiteboard", "Yogamatten", "Meditationskissen", "Moderationskoffer"],
  anreiseOptions: ["PKW", "Bahn / Öffentliche", "Bus (organisiert)", "Kombination"],
  zahlungOptions: ["Banküberweisung", "Bar", "Auf Rechnung"],
  budgetOptions: ["unter 500 €", "500 – 2.000 €", "2.000 – 5.000 €", "über 5.000 €"],
  quelleOptions: ["Google", "Instagram", "Empfehlung", "Facebook", "Messe / Veranstaltung", "Sonstiges"],
};

export async function loadConfigFromDB(slug: string): Promise<EventConfig> {
  try {
    const { prisma } = await import("@/lib/db");
    const client = await prisma.client.findUnique({ where: { slug } });
    if (client) {
      const cfg = JSON.parse(client.config) as EventConfig;
      return { ...ARRAY_DEFAULTS, ...cfg };
    }
  } catch {
    // DB not available, fall through to file
  }
  return loadConfig(slug);
}

export function loadConfig(kunde?: string | null): EventConfig {
  const safe = /^[a-z0-9-]+$/.test(kunde ?? "") ? kunde! : "default";
  const filePath = path.join(CLIENTS_DIR, `${safe}.json`);

  if (!fs.existsSync(filePath)) {
    return JSON.parse(
      fs.readFileSync(path.join(CLIENTS_DIR, "default.json"), "utf-8")
    ) as EventConfig;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as EventConfig;
}
