export type Plan = "basis" | "pro" | "premium";

const PLAN_ORDER: Plan[] = ["basis", "pro", "premium"];

// Which plan first unlocks a given feature. Add new features here as they're gated.
const FEATURE_MIN_PLAN = {
  rooms: "pro",
} as const satisfies Record<string, Plan>;

export type Feature = keyof typeof FEATURE_MIN_PLAN;

export const PLAN_LABELS: Record<Plan, string> = { basis: "Basis", pro: "Pro", premium: "Premium" };

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(FEATURE_MIN_PLAN[feature]);
}

export function minPlanFor(feature: Feature): Plan {
  return FEATURE_MIN_PLAN[feature];
}

// Max rooms per client, by plan. null = unlimited.
const ROOM_LIMIT: Record<Plan, number | null> = { basis: 0, pro: 3, premium: null };

export function roomLimitFor(plan: Plan): number | null {
  return ROOM_LIMIT[plan];
}

// Max active events per client, by plan. null = unlimited. Unlike rooms,
// events are available on every plan — only the count is gated.
const EVENT_LIMIT: Record<Plan, number | null> = { basis: 3, pro: null, premium: null };

export function eventLimitFor(plan: Plan): number | null {
  return EVENT_LIMIT[plan];
}

// Max Standorte (Client slugs) per Organization, by plan. null = unlimited.
// Only the superadmin creates these today (no self-service UI), so this is
// the one thing standing between "1 Standort" on the Basis pricing card and
// it actually being true — see app/api/admin/orgs/[id]/clients/route.ts.
const LOCATION_LIMIT: Record<Plan, number | null> = { basis: 1, pro: 1, premium: null };

export function locationLimitFor(plan: Plan): number | null {
  return LOCATION_LIMIT[plan];
}

// Max team members (User rows) per Organization, by plan. null = unlimited.
const TEAM_LIMIT: Record<Plan, number | null> = { basis: 1, pro: 2, premium: null };

export function teamLimitFor(plan: Plan): number | null {
  return TEAM_LIMIT[plan];
}

export function isPlan(val: unknown): val is Plan {
  return typeof val === "string" && (PLAN_ORDER as string[]).includes(val);
}
