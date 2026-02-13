# asdev-automation-hub

Local-first, self-hosted automation platform (Zapier IR Lite) aligned with ASDEV standards.

## Scope
- In scope: Phase 0 + Phase 1 (connectors, templates, admin UI v0, self-host compose, smoke tests).
- Out of scope: marketplace, complex branching/loops, multi-provider connector matrix.

## Local Development
```bash
pnpm install
pnpm ci
```

## Run Services
```bash
export SECRET_KEY="<32+ char secret>"
export ADMIN_API_TOKEN="<strong-admin-token>"
pnpm --filter @asdev/web dev
pnpm --filter @asdev/runner dev
```

Health checks:
- `http://localhost:3000/health`
- `http://localhost:4000/health`

Admin dashboard:
- `http://localhost:3000/`

Admin API access for `/admin/*` requires:
- `Authorization: Bearer $ADMIN_API_TOKEN` (or `x-admin-api-token`)
- `x-asdev-user-id`
- `x-asdev-workspace-id`
- `x-asdev-role` (`ADMIN` or `OWNER`)

## Testing
```bash
pnpm test
```

## Self-host
```bash
docker compose up --build
```

## Contributing
See `CONTRIBUTING.md`.

## License
MIT

## Merge Runbook
See: `docs/merge-runbook.md`

## Reviewer Rotation (CODEOWNERS)
See: `docs/reviewer-rotation.md`
