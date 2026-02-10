# Testing & Quality Gates

**Version:** 1.0  
**Date:** 2026-02-10

CI gates:
- typecheck (TS strict)
- lint/format
- unit tests (engine/queue/interpolation)
- build

Suggested layers:
- unit + integration (Phase 0)
- E2E smoke (Phase 1)

Current smoke coverage:
- `apps/runner/tests/e2e.smoke.test.ts` validates end-to-end execution through `core.case`, `ir.payment`, and `ir.sms`.
