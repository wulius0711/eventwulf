import { test, expect } from "@playwright/test";
import { createTestClientWithAdmin, loginAsTestAdmin, deleteTestOrganization } from "../helpers/fixtures";

// Regression test for Medium finding 8 (Durchgang 2, part 2): JWT sessions
// were valid until their normal expiry (up to 7 days) regardless of a
// password change in the meantime — getSession() was pure JWT verification,
// no DB check at all. Every session now carries the user's passwordChangedAt
// at issuance and getSession() compares it against the live DB value on
// every request, so a password change invalidates every token issued before
// it — including the session that made the change itself, no special case.
test.describe("Password change invalidates existing sessions", () => {
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;
  const newPassword = "NewTestPass456!";

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("the old token stops working immediately, a fresh login after the change works", async ({ request }) => {
    await loginAsTestAdmin(request, org.email, org.password);

    // The pre-change token still works on a protected route.
    const before = await request.get("/api/admin/config");
    expect(before.status()).toBe(200);

    const changeRes = await request.put("/api/admin/account", {
      data: { currentPassword: org.password, newPassword },
    });
    expect(changeRes.ok()).toBe(true);

    // Same request context, same (now stale) cookie — including for the
    // admin who made the change themselves.
    const after = await request.get("/api/admin/config");
    expect(after.status()).toBe(401);

    // Logging in again with the new password issues a fresh, valid token.
    await loginAsTestAdmin(request, org.email, newPassword);
    const afterRelogin = await request.get("/api/admin/config");
    expect(afterRelogin.status()).toBe(200);
  });
});
