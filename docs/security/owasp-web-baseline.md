# OWASP Web Baseline

## Authentication / Session
- Enforce server-side authz checks on all protected endpoints.
- Use secure session/token settings and rotation policy.

## Input Validation
- Validate all external input at boundary layer.
- Normalize and reject malformed payloads early.

## Output / Headers
- Add security headers (CSP, X-Content-Type-Options, Referrer-Policy).
- Avoid exposing stack traces and sensitive internals.

## Data Protection
- Avoid secrets in source.
- Mask PII/secrets in logs and telemetry.

## Dependency / Supply Chain
- Weekly dependency updates.
- Block merges on high/critical vulnerable dependencies.
