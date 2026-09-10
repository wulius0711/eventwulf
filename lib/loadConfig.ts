import fs from "fs";
import path from "path";
import type { EventConfig } from "@/lib/types";

const CLIENTS_DIR = path.join(process.cwd(), "config", "clients");

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

// Per-field merge, recursive for nested objects (e.g. `company`) — a DB config
// that only sets company.name must not wipe out company.primaryColor etc. from
// the base. Arrays (e.g. the *Options lists) are treated as atomic — a chosen
// options list is a unit, not something to merge element-by-element — and
// null/undefined in the override means "not set", falling through to base.
function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(override)) return base;
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(override)) {
    const overrideVal = override[key];
    if (overrideVal === null || overrideVal === undefined) continue;
    const baseVal = result[key];
    result[key] = isPlainObject(overrideVal) && isPlainObject(baseVal) ? deepMerge(baseVal, overrideVal) : overrideVal;
  }
  return result as T;
}

export async function loadConfigFromDB(slug: string): Promise<EventConfig> {
  // Always resolves to a complete config — loadConfig() itself falls back to
  // default.json when there's no per-client file, so this is the base that
  // every field ultimately falls back to if the DB doesn't set it.
  const fileOrDefault = loadConfig(slug);
  try {
    const { prisma } = await import("@/lib/db");
    const client = await prisma.client.findUnique({ where: { slug } });
    if (client) {
      const dbConfig = JSON.parse(client.config) as Partial<EventConfig>;
      return deepMerge(fileOrDefault, dbConfig);
    }
  } catch {
    // DB unavailable or client.config unparseable — fall through to file/default
  }
  return fileOrDefault;
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
