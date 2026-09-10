import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClient, deleteTestClient, isoDateInDays } from "../helpers/fixtures";

// Regression test for Fund 7: personenAnzahl was parsed with parseInt()
// before any validation, which silently truncates non-integer input
// (parseInt("1.5") === 1) — zero, negative, and non-integer values all
// passed through unnoticed. Cases below send the raw string value exactly
// as it arrives in the request body, not a pre-parsed number — otherwise
// the "1.5" case wouldn't actually exercise the bug.
test.describe("Participant count validation in /api/submit", () => {
  let client: Awaited<ReturnType<typeof createTestClient>>;

  test.beforeAll(async () => {
    client = await createTestClient();
  });

  test.afterAll(async () => {
    await deleteTestClient(client.id);
  });

  function payload(personenAnzahl: string) {
    return {
      slug: client.slug,
      artTitel: "Participant Count Validation Test",
      nameGruppenleitung: "Tester",
      email: "guest@example.com",
      datumVon: isoDateInDays(30),
      datumBis: isoDateInDays(30),
      personenAnzahl,
    };
  }

  for (const value of ["0", "-5", "1.5", "", "abc"]) {
    test(`rejects personenAnzahl "${value}"`, async ({ request }) => {
      const res = await request.post("/api/submit", { data: payload(value) });
      expect(res.status()).toBe(400);
    });
  }

  test("accepts a valid positive integer", async ({ request }) => {
    const res = await request.post("/api/submit", { data: payload("8") });
    expect(res.status()).toBe(200);

    const saved = await prisma.inquiry.findMany({ where: { clientId: client.id, participantCount: 8 } });
    expect(saved).toHaveLength(1);
  });
});
