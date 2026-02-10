# Development Roadmap

**Version:** 1.0  
**Date:** 2026-02-10

## Goal
Move from Phase 1 prototype delivery to a production-ready self-hosted platform without adding unnecessary architecture.

## Track A — Platform Hardening (Phase 2)
1. Auth + workspace persistence
2. Postgres-backed control-plane repositories
3. Run-level observability (timeline API backed by DB)
4. Security tightening (secrets rotation playbook, dependency audit gate)

Definition of done:
- Strict TS/lint/tests/build pass
- Migration scripts reviewed and reversible
- Admin APIs documented with request/response examples

## Track B — Operator Experience (Phase 2)
1. Admin runs screen filters and retry controls wired to service methods
2. Connection test UX with provider-specific diagnostics
3. Template install wizard with preflight checklist (required connections)

Definition of done:
- E2E smoke validates template installation and a full run
- Docs updated in `docs/product/admin-panel.md`

## Track C — Extensibility (Phase 3)
1. Connector SDK guide and examples
2. Conditional DSL steps (`if`) with deterministic evaluation
3. Template lifecycle policy (create/update/deprecate)

Definition of done:
- Backward compatibility tests for DSL v0 flows
- ADRs for DSL branching and connector contract evolution

## Delivery Rhythm
- PR-1: Persistence + migrations + repository interfaces
- PR-2: Admin controls and run timeline APIs
- PR-3: Security and audit enhancements
- PR-4: DSL conditional execution + SDK docs
