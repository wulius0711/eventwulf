import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClient, createTestRoom, deleteTestClient, isoDateInDays } from "../helpers/fixtures";

// Regression test for Medium finding 3 (Durchgang 1, part 3): a Room deleted
// by an admin between /api/submit's pre-check (room.findFirst) and the save
// transaction's tx.inquiry.create({ roomId }) previously hit the FK
// constraint (Inquiry.roomId -> Room) unhandled, surfacing as a generic 500.
// Confirmed empirically before the fix — both directly (deleting a Room, then
// attempting prisma.inquiry.create({ roomId: <deleted id> }) throws
// PrismaClientKnownRequestError code P2003, constraint Inquiry_roomId_fkey)
// and end-to-end through the real HTTP route (the exact same P2003 appeared
// in the server log for the unhandled 500 below, before route.ts's new
// `e.code === "P2003"` branch was added).
//
// The insert only fails this way because the Room row is genuinely gone by
// the time the transaction runs — Inquiry.room has onDelete: SetNull, which
// only rewrites EXISTING rows' roomId when a Room is deleted, it does not
// let a brand new insert reference an id that no longer exists.
//
// Timing: this is a genuine race, not a fixed sequence — a Room deleted
// before the request starts is already caught by the pre-check (400,
// unrelated to this bug), so hitting the actual P2003 path requires the
// deletion to land strictly between the pre-check and the transaction's
// insert. That window's absolute position moves with how "warm" the
// server's connections are — calibrated in isolation against a server that
// had already handled many prior requests, 140ms landed inside the window
// reliably; run as the very first request against a freshly started server,
// the same 140ms consistently landed too early (pre-check itself slower
// while cold, so the delete beat it). There's no reliable fixed delay across
// both cases, so — like the other best-effort races in this suite (e.g.
// event-holds-partial-failure.spec.ts) — a miss is fully expected and
// tolerated here: the hard invariant (never 500) is checked
// unconditionally, and the fix's specific 409 response is only checked when
// the race actually happens to land in the P2003 window. The unconditional,
// timing-independent proof that this scenario throws P2003 (and that code
// is what route.ts's new branch checks for) lives in
// __tests__/validation/room-deleted-p2003.spec.ts.
const DELETE_DELAY_MS = 140;

test.describe("Room deleted mid-submit", () => {
  let client: Awaited<ReturnType<typeof createTestClient>>;

  test.beforeAll(async () => {
    client = await createTestClient();
  });

  test.afterAll(async () => {
    await deleteTestClient(client.id);
  });

  test("a room deleted between the pre-check and the insert never surfaces as a 500", async ({ request }) => {
    const room = await createTestRoom(client.id, { name: "Deleted-mid-submit room" });

    const submitPromise = request.post("/api/submit", {
      data: {
        slug: client.slug,
        roomId: room.id,
        artTitel: "Race Test",
        nameGruppenleitung: "Tester",
        email: "guest@example.com",
        datumVon: isoDateInDays(20),
        datumBis: isoDateInDays(20),
        personenAnzahl: "5",
      },
    });

    // Direct DB delete (not through the admin HTTP route) so the calibrated
    // delay targets the actual race window under test, not the admin route's
    // own unrelated auth/plan-check overhead.
    const deletePromise = (async () => {
      await new Promise((r) => setTimeout(r, DELETE_DELAY_MS));
      await prisma.room.delete({ where: { id: room.id } }).catch(() => {});
    })();

    const [submitRes] = await Promise.all([submitPromise, deletePromise]);

    expect(submitRes.status()).not.toBe(500);

    const body = await submitRes.json();
    if (submitRes.status() === 409) {
      // The race landed in the intended window — the new P2003 branch fired.
      expect(body.error).toBe("Dieser Raum oder dieses Event ist inzwischen leider nicht mehr verfügbar");
    } else {
      // Race resolved another way (pre-check caught the deletion first, or
      // the insert committed before the delete landed) — still a defined,
      // non-500 outcome, just not the one this test targets.
      expect([200, 400]).toContain(submitRes.status());
    }

    // Whichever way the race resolved, no Inquiry may end up referencing a
    // roomId that points nowhere.
    const saved = await prisma.inquiry.findMany({ where: { clientId: client.id } });
    for (const inq of saved) {
      if (inq.roomId) {
        const stillExists = await prisma.room.findUnique({ where: { id: inq.roomId } });
        expect(stillExists).not.toBeNull();
      }
    }
  });
});
