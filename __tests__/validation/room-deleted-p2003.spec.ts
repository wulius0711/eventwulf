import { test, expect } from "@playwright/test";
import { Prisma } from "@prisma/client";
import { prisma } from "../helpers/testDb";
import { createTestClient, createTestRoom, deleteTestClient } from "../helpers/fixtures";

// Deterministic proof of the actual trigger for Medium finding 3 (Durchgang
// 1, part 3), independent of any HTTP timing: /api/submit's save transaction
// does tx.inquiry.create({ ..., roomId }) after a separate, earlier
// room.findFirst pre-check. If the Room is deleted in between (a concurrent
// admin action), the insert references an id that no longer exists.
// Inquiry.room has onDelete: SetNull, which only rewrites EXISTING rows'
// roomId when a Room is deleted — it does not let a brand new insert
// reference an already-deleted id, so the FK constraint rejects it. This is
// confirmed here directly (not raced over HTTP, where hitting the exact
// window between pre-check and insert is real but timing-sensitive — see
// the best-effort HTTP-level test in
// __tests__/concurrency/room-deleted-during-submit.spec.ts) so the failure
// mode itself is proven unconditionally: PrismaClientKnownRequestError,
// code P2003, exactly what route.ts's new catch branch checks for.
test.describe("Room FK violation on a stale roomId (P2003)", () => {
  let client: Awaited<ReturnType<typeof createTestClient>>;

  test.beforeAll(async () => {
    client = await createTestClient();
  });

  test.afterAll(async () => {
    await deleteTestClient(client.id);
  });

  test("inserting an Inquiry with a deleted room's id throws P2003", async () => {
    const room = await createTestRoom(client.id);
    await prisma.room.delete({ where: { id: room.id } });

    let caught: unknown;
    try {
      await prisma.inquiry.create({
        data: {
          clientId: client.id,
          data: "{}",
          status: "neu",
          participantCount: 1,
          cancelToken: `p2003-probe-${room.id}`,
          roomId: room.id,
        },
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe("P2003");
  });
});
