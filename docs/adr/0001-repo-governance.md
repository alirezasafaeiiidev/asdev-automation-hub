# ADR-0001: Repo Governance Baseline

## Status
Accepted

## Context
Need consistent governance across projects for CI, security, and release quality.

## Decision
- Keep current multi-repo approach with shared baseline documents.
- Enforce CI minimum gates: lint, typecheck, test, build.
- Require `.env.example` and secret-safe `.gitignore` patterns.
- Track roadmap tasks in `_audit` artifacts.

## Consequences
- Reduced delivery drift across repositories.
- Lower onboarding and operational risk.
