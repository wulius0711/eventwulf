-- Tracks when a user's password last changed, so an already-issued JWT
-- (valid up to 7 days) can be invalidated the moment the password it was
-- issued for is no longer current (Medium finding 8).
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
