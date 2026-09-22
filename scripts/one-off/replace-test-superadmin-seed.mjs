// One-off maintenance script, run once on 2026-09-22.
//
// WHY THIS EXISTS (hard-won constraint — read before touching test seed data)
// ----------------------------------------------------------------------------
// While writing a concurrency regression test for the Standorte/locations
// plan-limit race (__tests__/concurrency/plan-limit-race.spec.ts), the test
// needed a superadmin session — the only way to get one is a User whose
// login resolves session.clientSlug === SUPERADMIN_SLUG
// (app/api/admin/orgs/[id]/clients/route.ts has no separate role/flag).
//
// Looking up the Client with that slug in the TEST database
// (TEST_DATABASE_URL, Neon branch "ep-mute-pond-...") turned up a REAL
// record: an Organization/Client/User with the developer's actual email
// address, not synthetic test fixture data. Reconstructed timeline:
//
//   2026-04-24  Initial commit ("yogawulf retreat booking app"). The found
//               record's Client.createdAt is the SAME DAY, shortly after —
//               this is `npm run seed` run locally against what was then
//               the only database, with the developer's real email as
//               SEED_EMAIL (a normal bootstrap step for a brand-new,
//               customer-less project).
//   2026-08-24  The record's updatedAt — still in active local use.
//   2026-09-10  Commit 433e9a8 introduces TEST_DATABASE_URL / dedicated
//               Neon test branch for Playwright. The test branch almost
//               certainly came from a copy-on-write fork of the then-current
//               dev database, inheriting the April seed data as a byproduct.
//
// Net effect: real personal data (an email address) was sitting in a
// database whose entire purpose is disposable/automated-test-only, and nothing
// in the codebase ever intentionally referenced it — a defensive cleanup
// step in an earlier draft of the locations test would have deleted it
// outright, saved only by an incidental foreign-key error (BlockedDate),
// not by design. This script replaces that real record with a clearly
// synthetic one of the same shape, so the test still has what it needs.
//
// SAFETY
// ------
// - Reads ONLY TEST_DATABASE_URL (never DATABASE_URL) and refuses to run
//   unless its host matches the known test-branch host exactly.
// - Refuses to run unless the existing record matches the exact shape that
//   was investigated (one Client, one User, that user being the known real
//   email) — not a generic "wipe anything with this slug".
// - Delete-then-recreate runs inside one interactive prisma.$transaction:
//   if anything after the deletes fails, the whole transaction rolls back
//   and the original record is left untouched — there's no window where
//   neither the old nor the new record exists.
// - ep-wandering-king (DATABASE_URL, the real dev database the developer
//   actually logs into) is a fully independent Neon endpoint from
//   ep-mute-pond (TEST_DATABASE_URL) — Neon branches don't stay live-synced
//   after a copy-on-write fork, in either direction. This script cannot
//   reach or affect the real dev database.
//
// Run with (from repo root, needs TEST_DATABASE_URL + SUPERADMIN_SLUG from
// .env.local in the environment):
//   node -e "require('dotenv').config({path:'.env.local'}); import('./scripts/one-off/replace-test-superadmin-seed.mjs')"

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashSync } from "bcryptjs";
import { randomBytes } from "crypto";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const EXPECTED_HOST = "ep-mute-pond-alppc2hj-pooler.c-3.eu-central-1.aws.neon.tech";

if (!TEST_DB_URL) throw new Error("TEST_DATABASE_URL not set — refusing to run without it.");
const actualHost = new URL(TEST_DB_URL).host;
if (actualHost !== EXPECTED_HOST) {
  throw new Error(`Refusing to run: TEST_DATABASE_URL host is "${actualHost}", expected exactly "${EXPECTED_HOST}". This script must only ever touch the dedicated test branch.`);
}
console.log(`Confirmed target: ${actualHost} (TEST_DATABASE_URL) — proceeding.`);

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: TEST_DB_URL })) });

const SUPERADMIN_SLUG = process.env.SUPERADMIN_SLUG ?? "admin";
const KNOWN_REAL_USER_EMAIL = "werbesan@gmail.com"; // extra guard, see below

async function main() {
  const client = await prisma.client.findUnique({
    where: { slug: SUPERADMIN_SLUG },
    include: { organization: { include: { users: true, clients: true } } },
  });

  if (!client) {
    console.log(`No Client with slug "${SUPERADMIN_SLUG}" found — nothing to replace.`);
    return;
  }
  const org = client.organization;
  const realUser = org?.users.find((u) => u.email === KNOWN_REAL_USER_EMAIL);

  // Extra guard: only proceed if this is recognizably the SAME record
  // investigated above (org has exactly this one client, exactly this one
  // real user) — not a generic "anything with this slug" wipe.
  if (!org || org.clients.length !== 1 || org.users.length !== 1 || !realUser) {
    throw new Error(
      "Refusing to run: the record under this slug no longer matches the shape that was investigated " +
      "(expected exactly one Client and one User, the latter being werbesan@gmail.com). Re-check manually."
    );
  }

  console.log("About to replace:", {
    organizationId: org.id,
    clientId: client.id,
    userId: realUser.id,
    userEmail: realUser.email,
  });

  const defaultConfig = JSON.stringify({ company: { name: "Synthetic Test Superadmin" }, notifyEmail: "" });
  const fakeEmail = `superadmin-test-${randomBytes(4).toString("hex")}@example.invalid`;

  await prisma.$transaction(async (tx) => {
    // Delete order respects the schema's FK constraints (no cascade on
    // BlockedDate->Client or Client->Organization / User->Organization).
    await tx.blockedDate.deleteMany({ where: { clientId: client.id } });
    await tx.client.delete({ where: { id: client.id } });
    await tx.user.delete({ where: { id: realUser.id } });
    await tx.organization.delete({ where: { id: org.id } });

    await tx.organization.create({
      data: {
        name: "superadmin-test",
        clients: { create: { slug: SUPERADMIN_SLUG, config: defaultConfig } },
        users: { create: { email: fakeEmail, password: hashSync(randomBytes(32).toString("hex"), 12) } },
      },
    });
  });

  console.log(`Done. Replacement Client "${SUPERADMIN_SLUG}" now belongs to a synthetic org/user (${fakeEmail}).`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
