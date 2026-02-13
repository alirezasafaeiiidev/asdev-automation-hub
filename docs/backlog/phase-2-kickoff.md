# Phase 2 Kickoff Board

Date: 2026-02-13
Status: in_progress

## Objective
Move from Phase 1 prototype completion to a production-ready self-hosted platform baseline.

## Track A - Platform Hardening

- [ ] P2-A1 Auth + workspace persistence
- [x] P2-A2 Postgres-backed control-plane repositories
- [x] P2-A3 Run timeline API backed by DB
- [ ] P2-A4 Security tightening (secrets rotation playbook + dependency audit gate)

## Track B - Operator Experience

- [x] P2-B1 Admin runs screen filters and retry controls
- [ ] P2-B2 Connection diagnostics UX by provider
- [ ] P2-B3 Template install wizard with preflight checklist

## Definition of Done

- [x] `pnpm lint` passes
- [x] `pnpm typecheck` passes
- [x] `pnpm test` passes
- [x] `pnpm build` passes
- [x] Admin APIs documented with request/response examples
- [ ] E2E smoke validates template installation and a full run

## PR-1 Notes

- Added `ControlPlaneStore` repository interface with `InMemoryStore` and `PostgresStore` implementations.
- Wired `@asdev/web` server context to select store backend via `CONTROL_PLANE_STORE` / `DATABASE_URL`.
- Added migration `0002_run_updated_at` and aligned `prisma/schema.prisma` for persistent run timeline updates.
