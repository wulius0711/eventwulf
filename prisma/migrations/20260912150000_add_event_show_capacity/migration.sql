-- Per-event toggle for whether remaining capacity is shown in the
-- calendar/widget, replacing the old client-wide EventConfig.showCapacity
-- (a JSON config field, not a DB column) — capacity visibility is a
-- per-event preference, not a global one.
ALTER TABLE "Event" ADD COLUMN "showCapacity" BOOLEAN NOT NULL DEFAULT true;
