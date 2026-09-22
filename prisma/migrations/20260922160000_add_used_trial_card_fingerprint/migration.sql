CREATE TABLE "UsedTrialCardFingerprint" (
    "fingerprint" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsedTrialCardFingerprint_pkey" PRIMARY KEY ("fingerprint")
);
