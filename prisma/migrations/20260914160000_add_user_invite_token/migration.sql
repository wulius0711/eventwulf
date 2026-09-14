-- Team-invite flow: an invited member gets a User row with a random unusable
-- password and this token, set for real when they accept the invite (see
-- app/api/admin/team/accept/route.ts).
ALTER TABLE "User" ADD COLUMN "inviteToken" TEXT;
ALTER TABLE "User" ADD COLUMN "inviteTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_inviteToken_key" ON "User"("inviteToken");
