import fs from "fs";
import path from "path";
import type { YogaConfig } from "@/lib/types";

const CLIENTS_DIR = path.join(process.cwd(), "config", "clients");

export async function loadConfigFromDB(slug: string): Promise<YogaConfig> {
  try {
    const { prisma } = await import("@/lib/db");
    const client = await prisma.client.findUnique({ where: { slug } });
    if (client) return JSON.parse(client.config) as YogaConfig;
  } catch {
    // DB not available, fall through to file
  }
  return loadConfig(slug);
}

export function loadConfig(kunde?: string | null): YogaConfig {
  const safe = /^[a-z0-9-]+$/.test(kunde ?? "") ? kunde! : "default";
  const filePath = path.join(CLIENTS_DIR, `${safe}.json`);

  if (!fs.existsSync(filePath)) {
    return JSON.parse(
      fs.readFileSync(path.join(CLIENTS_DIR, "default.json"), "utf-8")
    ) as YogaConfig;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as YogaConfig;
}
