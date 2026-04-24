-- Create Organization table
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- Add organizationId to Client (nullable)
ALTER TABLE "Client" ADD COLUMN "organizationId" TEXT;

-- Add organizationId to User (nullable)
ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;

-- Create one Organization per existing Client
INSERT INTO "Organization" ("id", "name", "createdAt")
SELECT gen_random_uuid(), slug, "createdAt" FROM "Client";

-- Link each Client to its Organization (matched by slug = org name)
UPDATE "Client" c SET "organizationId" = o.id
FROM "Organization" o WHERE o.name = c.slug;

-- Link each User to its Organization via the old clientId
UPDATE "User" u SET "organizationId" = c."organizationId"
FROM "Client" c WHERE c.id = u."clientId";

-- Add FK for Client → Organization
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add FK for User → Organization
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old User → Client FK and column
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_clientId_fkey";
ALTER TABLE "User" DROP COLUMN IF EXISTS "clientId";
