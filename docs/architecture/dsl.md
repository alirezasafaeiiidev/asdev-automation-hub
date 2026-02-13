# Workflow DSL v0 Specification

**Version:** 1.1  
**Date:** 2026-02-13

## Scope

Minimal DSL for Phase 0–1:

- Trigger + linear steps
- Step policies (timeout/retry)
- Variable interpolation
- Idempotency hooks

## Step fields

- id
- connector
- operation
- connectionId (optional)
- input
- policy (optional): timeoutMs, maxAttempts, backoffMs

## Interpolation

Tokens:

- `{{trigger.path}}`
- `{{stepId.output.path}}`
- `{{env.path}}`

Notes:

- `{{stepId.path}}` is accepted for backward compatibility and resolves against `stepId.output.path`.
- If a field is a single token (for example `{{trigger}}`), the resolved JSON type is preserved instead of stringifying.

## Idempotency

idempotencyKey = runId + ':' + stepId
Passed into connector ctx.
