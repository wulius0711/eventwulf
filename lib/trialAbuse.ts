import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";

// Trial-abuse guard (Durchgang 1, business-risk finding): records a card
// fingerprint's first signup, or reports that it was already seen before.
// Kept independent of Organization (see the UsedTrialCardFingerprint model)
// so deleting the org it was first used on doesn't let the same card start
// a fresh free trial by signing up again with a throwaway email.
//
// Deliberately DB-only — no Stripe call here. The actual
// stripe.subscriptions.retrieve()/update() calls live in
// app/api/stripe/webhook/route.ts and aren't automated-test-covered for the
// same live-key reason as subscriptionSync (Phase 5) and disputeClosedResult
// (chargeback handling) — this function is the part of the fix that can
// actually be tested directly against the database.
//
// `db` is injectable (defaulting to the real app-wide client) specifically
// so tests can pass __tests__/helpers/testDb's client instead — lib/db.ts's
// singleton reads DATABASE_URL, which in the Playwright test-runner
// process (as opposed to the spawned app server) is never pointed at the
// test branch. Every other function pulled out for testability so far in
// this audit (subscriptionSync, disputeClosedResult, the email templates)
// sidestepped this by being pure with no DB access at all; this is the
// first one that touches the database, which is what surfaced it.
export async function recordSignupCardFingerprint(
  fingerprint: string,
  db: Pick<PrismaClient, "usedTrialCardFingerprint"> = defaultPrisma
): Promise<{ alreadyUsed: boolean }> {
  const existing = await db.usedTrialCardFingerprint.findUnique({ where: { fingerprint } });
  if (existing) return { alreadyUsed: true };

  try {
    await db.usedTrialCardFingerprint.create({ data: { fingerprint } });
    return { alreadyUsed: false };
  } catch (e) {
    // Lost a race against a concurrent signup using the exact same card —
    // same P2002 pattern already used in app/api/submit/route.ts,
    // app/api/autologin/route.ts and app/api/admin/team/route.ts. Two
    // signups completing with the same fingerprint at the same instant is
    // as clear a "same card" signal as this check gets, so the loser is
    // treated as a detected reuse too, not an error.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { alreadyUsed: true };
    }
    throw e;
  }
}
