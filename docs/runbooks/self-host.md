# Runbook — Self-host (Initial)

**Version:** 0.1  
**Date:** 2026-02-10

## Target stack
- `docker-compose.yml` with `postgres`, `web`, `runner`
- Health endpoints:
  - `GET /health` on web (port `3000`)
  - `GET /health` on runner (port `4000`)

## Start
Create `.env` in repo root:

```bash
SECRET_KEY="<32+ char secret>"
ADMIN_API_TOKEN="<strong-admin-token>"
IR_SMS_API_KEY=""
IR_PAYMENT_MERCHANT_ID=""
IR_PAYMENT_CALLBACK_URL="https://localhost/payment/callback"
```

Then start services:

```bash
docker compose up --build
```

## Verify
```bash
curl -fsS http://localhost:3000/health
curl -fsS http://localhost:4000/health
```

## Notes
- Connector credentials are optional; when missing, connectors run in deterministic mock mode.
- `SECRET_KEY` and `ADMIN_API_TOKEN` are required; compose fails fast if they are missing.
- For production, replace default secrets and use managed Postgres credentials.
- Rotate runtime/application secrets via: `docs/runbooks/secrets-rotation.md`.
