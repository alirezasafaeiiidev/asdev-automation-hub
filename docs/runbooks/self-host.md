# Runbook — Self-host (Initial)

**Version:** 0.1  
**Date:** 2026-02-10

## Target stack
- `docker-compose.yml` with `postgres`, `web`, `runner`
- Health endpoints:
  - `GET /health` on web (port `3000`)
  - `GET /health` on runner (port `4000`)

## Start
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
- For production, replace default secrets and use managed Postgres credentials.
