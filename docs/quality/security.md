# Security Baseline

**Version:** 1.1  
**Date:** 2026-02-13

- Encrypt secrets at rest
- Mask secrets in logs/UI
- Webhook secrets + validation
- Workspace-scoped RBAC checks
- Dependency audit in CI
- Admin API access restricted to `OWNER` / `ADMIN`
- Required runtime secrets for self-host compose: `SECRET_KEY`, `ADMIN_API_TOKEN`
- Secrets rotation runbook: `docs/runbooks/secrets-rotation.md`
