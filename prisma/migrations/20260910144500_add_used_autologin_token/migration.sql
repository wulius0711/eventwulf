-- Replay protection for autologin tokens (Medium finding 9): the unique
-- constraint on tokenHash is the atomic check-and-insert guard itself.
CREATE TABLE "UsedAutologinToken" (
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsedAutologinToken_pkey" PRIMARY KEY ("tokenHash")
);
