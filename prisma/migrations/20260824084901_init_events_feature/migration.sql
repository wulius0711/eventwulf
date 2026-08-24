-- DropForeignKey
ALTER TABLE "Inquiry" DROP CONSTRAINT "Inquiry_packageId_fkey";

-- DropForeignKey
ALTER TABLE "Package" DROP CONSTRAINT "Package_clientId_fkey";

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "color" TEXT NOT NULL DEFAULT '',
    "intern" BOOLEAN NOT NULL DEFAULT false,
    "pricePerPerson" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minParticipants" INTEGER NOT NULL DEFAULT 1,
    "maxParticipants" INTEGER,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: carry over existing BlockedDate(type='event') rows before their source columns are dropped.
-- intern=true preserves today's (accidental) blocking behavior of isBlocked() — hotels can consciously
-- switch individual events to "extern" afterwards via the admin UI once it exists.
INSERT INTO "Event" (
  "id", "clientId", "name", "startDate", "endDate", "color", "intern",
  "maxParticipants", "bookedCount", "createdAt", "updatedAt"
)
SELECT
  "id", "clientId", "label", "startDate", "endDate", "color", true,
  "maxCapacity", "bookedCount", "createdAt", "createdAt"
FROM "BlockedDate"
WHERE "type" = 'event';

-- DataMigration: remove the now-duplicated rows from BlockedDate, they live in Event now.
DELETE FROM "BlockedDate" WHERE "type" = 'event';

-- AlterTable
ALTER TABLE "BlockedDate" DROP COLUMN "bookedCount",
DROP COLUMN "color",
DROP COLUMN "maxCapacity",
DROP COLUMN "type";

-- AlterTable
ALTER TABLE "Inquiry" DROP COLUMN "packageId",
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "holdExpiresAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "Package";

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint: capacity invariants enforced at the DB level, not just in application code
ALTER TABLE "Event" ADD CONSTRAINT "Event_capacity_bounds"
  CHECK ("maxParticipants" IS NULL OR "minParticipants" <= "maxParticipants");

ALTER TABLE "Event" ADD CONSTRAINT "Event_bookedCount_within_capacity"
  CHECK ("maxParticipants" IS NULL OR "bookedCount" <= "maxParticipants");

ALTER TABLE "Event" ADD CONSTRAINT "Event_bookedCount_non_negative"
  CHECK ("bookedCount" >= 0);
