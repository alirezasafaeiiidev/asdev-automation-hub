-- Phase 2 queue persistence baseline: postgres-backed job queue with claim/retry state
CREATE TABLE "queue_jobs" (
  "id" TEXT PRIMARY KEY,
  "run_id" TEXT NOT NULL,
  "step_id" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "available_at" TIMESTAMPTZ NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "claimed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "queue_jobs_available_at_idx" ON "queue_jobs"("available_at");
CREATE INDEX "queue_jobs_claimed_at_idx" ON "queue_jobs"("claimed_at");
