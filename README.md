# asdev_lap

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
pnpm --filter @asdev/web dev
pnpm --filter @asdev/runner dev
```

Health checks:
- `http://localhost:3000/health`
- `http://localhost:4000/health`

Admin dashboard:
- `http://localhost:3000/`

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
