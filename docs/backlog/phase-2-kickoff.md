# Phase 2 Kickoff Board

Date: 2026-02-13
Status: in_progress

## Objective
Move from Phase 1 prototype completion to a production-ready self-hosted platform baseline.

## Track A - Platform Hardening

- [ ] P2-A1 Auth + workspace persistence (tracked: issue #11)
- [x] P2-A2 Postgres-backed control-plane repositories
- [x] P2-A3 Run timeline API backed by DB
- [x] P2-A4 Security tightening (secrets rotation playbook + dependency audit gate)

## Track B - Operator Experience

- [x] P2-B1 Admin runs screen filters and retry controls
- [x] P2-B2 Connection diagnostics UX by provider
- [x] P2-B3 Template install wizard with preflight checklist

## Definition of Done

- [x] `pnpm lint` passes
- [x] `pnpm typecheck` passes
- [x] `pnpm test` passes
- [x] `pnpm build` passes
- [x] Admin APIs documented with request/response examples
- [ ] E2E smoke validates template installation and a full run (tracked: issue #10)

## PR-1 Notes

- Added `ControlPlaneStore` repository interface with `InMemoryStore` and `PostgresStore` implementations.
- Wired `@asdev/web` server context to select store backend via `CONTROL_PLANE_STORE` / `DATABASE_URL`.
- Added migration `0002_run_updated_at` and aligned `prisma/schema.prisma` for persistent run timeline updates.

## PR-2 Notes

- Added admin run controls endpoints: `GET /admin/runs/timeline` and `POST /admin/runs/retry`.
- Added workflow-aware filtering for `GET /admin/runs`.
- Added endpoint integration coverage in `apps/web/tests/server-runs.test.ts`.

## PR-3 Notes

- Added secrets rotation runbook at `docs/runbooks/secrets-rotation.md`.
- Linked security baseline and self-host runbook to the rotation process.
- Kept dependency audit gate active in CI (`.github/workflows/ci.yml` -> `Dependency audit` step).

## PR-4 Notes

- Added operator endpoints for template install flow:
  - `GET /admin/templates`
  - `POST /admin/templates/preflight`
  - `POST /admin/templates/install`
- Added provider diagnostics endpoint:
  - `POST /admin/connections/test`
- Added endpoint integration coverage in `apps/web/tests/server-templates.test.ts`.

## Open Tasks (Current)

- `#11` P2-A1 Auth + workspace persistence integration:
  - https://github.com/alirezasafaeiiidev/asdev-automation-hub/issues/11
- `#10` P2-QA E2E smoke for template install + full run:
  - https://github.com/alirezasafaeiiidev/asdev-automation-hub/issues/10
