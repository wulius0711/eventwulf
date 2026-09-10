-- Invoice numbers are scoped per client (Medium finding 7) — two different
-- clients can both legitimately have "ANB-2026-0001".
DROP INDEX "Invoice_number_key";
CREATE UNIQUE INDEX "Invoice_clientId_number_key" ON "Invoice"("clientId", "number");
