-- Phase 2 persistence baseline: track run updates for timeline and retry flows
ALTER TABLE "Run"
ADD COLUMN "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE "Run"
SET "updatedAt" = "createdAt"
WHERE "updatedAt" IS NULL;
