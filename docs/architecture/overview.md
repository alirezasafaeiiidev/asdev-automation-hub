# Architecture Overview

**Version:** 1.1  
**Date:** 2026-02-13

## Goals

- Self-host, local-first automation platform
- Modular: workflow DSL + connectors + templates
- Strong observability: Run/StepRun logs drive admin panel
- Minimal critical dependencies: Postgres is the primary dependency

## Components

1. Control Plane (apps/web): Admin UI + APIs + auth + workflow management
2. Execution Plane (apps/runner): job polling + execution + retries + logs
3. Storage (Postgres): tenant/workflow versions/runs/cases/payments/messages + `queue_jobs`

## Typical flow

Trigger → create Run → execute steps → persist StepRun → update domain entities → view in Admin UI.

## Constraints

- No Redis in v0
- Queue is Postgres-backed (`queue_jobs` + `FOR UPDATE SKIP LOCKED`)
- No marketplace or complex branching early
- Connectors first-party initially
