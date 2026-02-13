# ADR 0002 — Postgres-based Queue (No Redis)

**Status:** Accepted  
**Date:** 2026-02-10

Decision: Implement job queue in Postgres using SKIP LOCKED to minimize dependencies for self-host.

## Queue Contract (v1)
- Table: `queue_jobs`
- Columns:
  - `id` (PK)
  - `run_id`
  - `step_id`
  - `payload` (`jsonb`)
  - `available_at` (`timestamptz`)
  - `attempts` (`int`)
  - `max_attempts` (`int`)
  - `claimed_at` (`timestamptz`, nullable)
  - `created_at` (`timestamptz`)
- Claim query requirements:
  - `available_at <= NOW()`
  - `claimed_at IS NULL`
  - `FOR UPDATE SKIP LOCKED`
