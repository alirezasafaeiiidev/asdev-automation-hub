# Admin Panel Specification (MVP)

**Version:** 1.0  
**Date:** 2026-02-10

## Screens
- Workflows: list, publish version, activate/deactivate
- Runs: list + filters, run detail timeline, retry run
- Connections: create/list/test connection
- Audit logs: workflow/connection changes

## Phase 1 implementation
- Minimal dashboard page: `GET /`
- JSON endpoints:
  - `GET /admin/workflows`
  - `GET /admin/runs?status=PENDING|RUNNING|SUCCEEDED|FAILED`
  - `GET /admin/connections`
- Service capabilities:
  - Workflow activation toggles
  - Run retry + timeline retrieval
  - Connection test hook

## Principle
Everything must be observable (Run/StepRun).
