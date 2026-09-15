// One-off script to create the "demo" client used for the interactive widget
// preview embedded on eventwulf.at (Features + Events sections). Run once;
// safe to re-run (skips if the client already exists).
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashSync } from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SLUG = "demo";

const config = {
  company: {
    name: "Almhof Retreat (Demo)",
    tagline: "Beispiel-Kunde zum Ausprobieren des eventwulf-Widgets",
    logo: "",
    email: "demo@eventwulf.at",
    phone: "+43 1 234567",
    website: "https://eventwulf.at",
    address: "Musterstraße 1, 1010 Wien",
    primaryColor: "#156e47",
  },
  formTitle: "Du hast Interesse an einem Event bei uns?",
  formTitleFont: "Inter",
  verpflegungOptions: ["Keine", "Frühstück", "Mittagessen", "Abendessen", "Kaffeepauschale", "Obst / Nüsse", "Kuchen", "Selbstversorgung"],
  zimmerwunschOptions: ["Keine Zimmer", "Einzelzimmer", "Doppelzimmer", "Mehrbettzimmer", "Apartements"],
  abrechnungOptions: ["Veranstalter", "Teilnehmer zahlen selbst", "Teilnehmer zahlen Nächtigung, Veranstalter zahlt Räumlichkeiten"],
  ausstattungOptions: ["Bestuhlung", "Tische", "Beamer / Projektor", "Soundanlage / Mikrofon", "Außenbereich", "Flipchart", "Whiteboard", "Yogamatten", "Meditationskissen", "Moderationskoffer"],
  anreiseOptions: ["PKW", "Bahn / Öffentliche", "Bus (organisiert)", "Kombination"],
  zahlungOptions: ["Banküberweisung", "Bar", "Auf Rechnung"],
  budgetOptions: ["unter 500 €", "500 – 2.000 €", "2.000 – 5.000 €", "über 5.000 €"],
  quelleOptions: ["Google", "Instagram", "Empfehlung", "Facebook", "Messe / Veranstaltung", "Sonstiges"],
  notifyEmail: "demo-unused@eventwulf.at",
};

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  const existing = await prisma.client.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`Client "${SLUG}" already exists (id ${existing.id}) — skipping.`);
    return;
  }

  const org = await prisma.organization.create({
    data: {
      name: "eventwulf Demo",
      plan: "premium",
      clients: { create: { slug: SLUG, config: JSON.stringify(config), isDemo: true } },
      users: { create: { email: "demo-owner-unused@eventwulf.at", password: hashSync(Math.random().toString(36), 12) } },
    },
    include: { clients: true },
  });
  const client = org.clients[0];
  console.log(`Created demo org (${org.id}) + client "${SLUG}" (${client.id})`);

  const room = await prisma.room.create({
    data: {
      clientId: client.id,
      name: "Seminarraum Alm",
      description: "Heller Seminarraum mit Panoramablick, bis zu 20 Personen.",
      capacity: 20,
      isActive: true,
      sortOrder: 0,
    },
  });
  await prisma.room.create({
    data: {
      clientId: client.id,
      name: "Yoga-Scheune",
      description: "Rustikale Scheune mit Holzboden, ideal für Yoga & Bewegung.",
      capacity: 15,
      isActive: true,
      sortOrder: 1,
    },
  });
  console.log("Created 2 demo rooms");

  await prisma.event.create({
    data: {
      clientId: client.id,
      roomId: room.id,
      name: "Yoga-Wochenende",
      description: "Ein entspanntes Wochenende mit täglichen Yoga-Einheiten, gutem Essen und Zeit für dich.",
      startDate: daysFromNow(21),
      endDate: daysFromNow(23),
      color: "#16a34a",
      pricePerPerson: 249,
      minParticipants: 1,
      maxParticipants: 15,
      showCapacity: true,
      isActive: true,
      sortOrder: 0,
    },
  });
  await prisma.event.create({
    data: {
      clientId: client.id,
      name: "Business-Seminar: Führung & Kommunikation",
      description: "Zweitägiges Intensiv-Seminar für Führungskräfte, inkl. Verpflegung.",
      startDate: daysFromNow(35),
      endDate: daysFromNow(36),
      color: "#2563eb",
      pricePerPerson: 390,
      minParticipants: 4,
      maxParticipants: 20,
      showCapacity: true,
      isActive: true,
      sortOrder: 1,
    },
  });
  console.log("Created 2 demo events");
  console.log(`Done. Widget URLs: /?kunde=${SLUG} and /events?kunde=${SLUG}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
