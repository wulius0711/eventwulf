-- No foreign-key columns had an index (Prisma's postgresql provider does not
-- add one automatically). Every tenant-scoped query filters by clientId or
-- organizationId, and the two hourly holds crons scan Inquiry by status +
-- holdExpiresAt across every tenant, so these were full-table scans that get
-- slower as total row counts grow, not per tenant.

-- CreateIndex
CREATE INDEX "Client_organizationId_idx" ON "Client"("organizationId");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "BlockedDate_clientId_idx" ON "BlockedDate"("clientId");

-- CreateIndex
CREATE INDEX "Inquiry_clientId_createdAt_idx" ON "Inquiry"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "Inquiry_status_holdExpiresAt_idx" ON "Inquiry"("status", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "Inquiry_roomId_status_idx" ON "Inquiry"("roomId", "status");

-- CreateIndex
CREATE INDEX "Inquiry_eventId_status_idx" ON "Inquiry"("eventId", "status");

-- CreateIndex
CREATE INDEX "Room_clientId_idx" ON "Room"("clientId");

-- CreateIndex
CREATE INDEX "Event_clientId_idx" ON "Event"("clientId");
