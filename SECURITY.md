# Security Policy

## Supported Versions

Only the latest `main` branch is supported for security fixes.

## Reporting a Vulnerability

Please report vulnerabilities privately via GitHub Security Advisories:
- Repository: `alirezasafaeiiidev/asdev-automation-hub`
- Use "Report a vulnerability" in the Security tab.

If advisory flow is unavailable, open a private channel with the maintainer and include:
- impact summary
- reproduction steps
- affected components and versions
- suggested remediation

Do not disclose exploitable details publicly before a fix is available.

## Security Baseline

- `SECRET_KEY` and `ADMIN_API_TOKEN` are required runtime secrets.
- `/admin/*` endpoints require explicit authorization headers.
- Production dependencies should pass `pnpm audit --prod --audit-level=high`.
