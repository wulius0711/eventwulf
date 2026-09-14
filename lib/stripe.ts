import Stripe from "stripe";
import type { Plan } from "@/lib/plan";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export type BillablePlan = Extract<Plan, "basis" | "pro">;
export type BillingInterval = "monthly" | "yearly";

// Premium has no fixed self-serve price — it's sold via manual sales contact,
// so it's deliberately absent here.
const PRICE_IDS: Record<BillablePlan, Record<BillingInterval, string>> = {
  basis: {
    monthly: "price_1UFGU9H9wnwEESOkhnVYK8cS",
    yearly: "price_1UFGXpH9wnwEESOk3p9PcO2G",
  },
  pro: {
    monthly: "price_1UFGZEH9wnwEESOk8MQRVHfu",
    yearly: "price_1UFGabH9wnwEESOkxpElB2Kz",
  },
};

export function priceIdFor(plan: BillablePlan, interval: BillingInterval): string {
  return PRICE_IDS[plan][interval];
}

export function planForPriceId(priceId: string): BillablePlan | null {
  for (const plan of Object.keys(PRICE_IDS) as BillablePlan[]) {
    if (Object.values(PRICE_IDS[plan]).includes(priceId)) return plan;
  }
  return null;
}
