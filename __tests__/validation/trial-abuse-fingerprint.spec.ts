import { randomBytes } from "crypto";
import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { recordSignupCardFingerprint } from "@/lib/trialAbuse";
import { createTestClientWithAdmin, deleteTestOrganization } from "../helpers/fixtures";

// Regression test for the trial-abuse (card fingerprint) product decision:
// the same card, reused across throwaway emails, otherwise gets an
// unlimited number of free 14-day trials. recordSignupCardFingerprint
// (lib/trialAbuse.ts) is the DB-only reuse-tracking half of the fix — the
// actual stripe.subscriptions.retrieve()/update() calls in
// app/api/stripe/webhook/route.ts aren't automated-test-covered for the
// same live-key reason as subscriptionSync (Phase 5) and
// disputeClosedResult (chargeback handling); see the maintainability
// backlog, one shared item for all three.
//
// The test-DB `prisma` client (../helpers/testDb) is passed explicitly on
// every call — recordSignupCardFingerprint's default parameter points at
// lib/db.ts's singleton, which reads DATABASE_URL and would otherwise hit
// the dev database from this process (the Playwright test runner, not the
// spawned app server that actually gets DATABASE_URL overridden to the
// test branch — see testDb.ts's own comment on this).
test.describe("recordSignupCardFingerprint — trial-abuse card tracking", () => {
  test("a first-time fingerprint is not reused, and gets recorded", async () => {
    const fingerprint = `fp_${randomBytes(8).toString("hex")}`;

    const result = await recordSignupCardFingerprint(fingerprint, prisma);
    expect(result.alreadyUsed).toBe(false);

    const stored = await prisma.usedTrialCardFingerprint.findUnique({ where: { fingerprint } });
    expect(stored).not.toBeNull();

    await prisma.usedTrialCardFingerprint.delete({ where: { fingerprint } });
  });

  test("the same fingerprint used a second time (different org) is detected as reused", async () => {
    const fingerprint = `fp_${randomBytes(8).toString("hex")}`;

    const first = await recordSignupCardFingerprint(fingerprint, prisma);
    expect(first.alreadyUsed).toBe(false);

    const second = await recordSignupCardFingerprint(fingerprint, prisma);
    expect(second.alreadyUsed).toBe(true);

    // Still exactly one row — the second call didn't duplicate it.
    const count = await prisma.usedTrialCardFingerprint.count({ where: { fingerprint } });
    expect(count).toBe(1);

    await prisma.usedTrialCardFingerprint.delete({ where: { fingerprint } });
  });

  test("deleting the organization that first used a card does NOT let it start over", async () => {
    const fingerprint = `fp_${randomBytes(8).toString("hex")}`;
    const org = await createTestClientWithAdmin();

    // Simulates the first signup: card recorded, org created normally.
    const first = await recordSignupCardFingerprint(fingerprint, prisma);
    expect(first.alreadyUsed).toBe(false);

    // The org gets deleted (churn, superadmin cleanup, whatever reason) —
    // UsedTrialCardFingerprint has no relation to Organization, so this
    // must survive it untouched.
    await deleteTestOrganization(org.organization.id, org.client.id);

    const second = await recordSignupCardFingerprint(fingerprint, prisma);
    expect(second.alreadyUsed).toBe(true);

    await prisma.usedTrialCardFingerprint.delete({ where: { fingerprint } });
  });

  test("concurrent signups with the exact same fingerprint: only one is treated as new", async () => {
    const fingerprint = `fp_${randomBytes(8).toString("hex")}`;

    const results = await Promise.all(Array.from({ length: 5 }, () => recordSignupCardFingerprint(fingerprint, prisma)));
    const newCount = results.filter((r) => !r.alreadyUsed).length;
    expect(newCount).toBe(1);

    const count = await prisma.usedTrialCardFingerprint.count({ where: { fingerprint } });
    expect(count).toBe(1);

    await prisma.usedTrialCardFingerprint.delete({ where: { fingerprint } });
  });
});
