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

export function isPlan(val: unknown): val is Plan {
  return typeof val === "string" && (PLAN_ORDER as string[]).includes(val);
}
