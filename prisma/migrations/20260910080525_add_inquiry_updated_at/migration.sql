-- AlterTable
-- Added nullable first, backfilled from createdAt (best available signal for
-- existing rows, since none of them have a real prior update timestamp),
-- then set NOT NULL — the standard safe pattern for adding a required column
-- to a non-empty table.
ALTER TABLE "Inquiry" ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "Inquiry" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "Inquiry" ALTER COLUMN "updatedAt" SET NOT NULL;
