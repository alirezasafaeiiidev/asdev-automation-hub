# Admin Panel Specification (MVP)

**Version:** 1.0  
**Date:** 2026-02-10

## Screens
- Workflows: list, publish version, activate/deactivate
- Runs: list + filters, run detail timeline, retry run
- Connections: create/list/test connection
- Audit logs: workflow/connection changes

## Phase 1 implementation
- Minimal dashboard page: `GET /`
- JSON endpoints:
  - `GET /admin/workflows`
  - `GET /admin/runs?status=PENDING|RUNNING|SUCCEEDED|FAILED`
  - `GET /admin/runs/timeline?runId=<run-id>`
  - `POST /admin/runs/retry`
  - `GET /admin/connections`
  - `POST /admin/connections/test`
  - `GET /admin/templates`
  - `POST /admin/templates/preflight`
  - `POST /admin/templates/install`
- Service capabilities:
  - Workflow activation toggles
  - Run retry + timeline retrieval
  - Connection test hook

## Request/Response Examples

### Get run timeline

Request:

```http
GET /admin/runs/timeline?runId=8f9f6e6f-2197-4e8e-90d2-67a7e80f6aa8
Authorization: Bearer <ADMIN_API_TOKEN>
x-asdev-user-id: admin-1
x-asdev-workspace-id: w1
x-asdev-role: ADMIN
```

Response (`200`):

```json
{
  "run": {
    "id": "8f9f6e6f-2197-4e8e-90d2-67a7e80f6aa8",
    "workflowId": "wf_1",
    "workflowVersion": 1,
    "status": "FAILED"
  },
  "steps": [
    {
      "id": "step_1",
      "runId": "8f9f6e6f-2197-4e8e-90d2-67a7e80f6aa8",
      "stepId": "s1",
      "attempt": 1,
      "status": "FAILED",
      "errorMessage": "timeout"
    }
  ]
}
```

### Retry a run

Request:

```http
POST /admin/runs/retry
Content-Type: application/json
Authorization: Bearer <ADMIN_API_TOKEN>
x-asdev-user-id: admin-1
x-asdev-workspace-id: w1
x-asdev-role: ADMIN

{"runId":"8f9f6e6f-2197-4e8e-90d2-67a7e80f6aa8"}
```

Response (`202`):

```json
{
  "id": "f2b6d1e2-cbe4-4b0f-bc61-8eaec53cde72",
  "workflowId": "wf_1",
  "workflowVersion": 1,
  "status": "PENDING"
}
```

### Test a connection

Request:

```http
POST /admin/connections/test
Content-Type: application/json
Authorization: Bearer <ADMIN_API_TOKEN>
x-asdev-user-id: admin-1
x-asdev-workspace-id: w1
x-asdev-role: ADMIN

{"connectionId":"7fa42169-a4f5-4b93-bf97-8dbce4dbf657"}
```

Response (`200`):

```json
{
  "ok": true
}
```

### Template preflight

Request:

```http
POST /admin/templates/preflight
Content-Type: application/json
Authorization: Bearer <ADMIN_API_TOKEN>
x-asdev-user-id: admin-1
x-asdev-workspace-id: w1
x-asdev-role: ADMIN

{"templateId":"service-booking-reminder"}
```

Response (`200`):

```json
{
  "templateId": "service-booking-reminder",
  "templateName": "Service Booking + Reminder",
  "requirements": [
    { "connector": "ir.payment", "connectionId": "conn_payment" },
    { "connector": "ir.sms", "connectionId": "conn_sms" }
  ],
  "availableProviders": ["ir.payment", "ir.sms"],
  "missingConnectors": [],
  "ready": true
}
```

### Install template

Request:

```http
POST /admin/templates/install
Content-Type: application/json
Authorization: Bearer <ADMIN_API_TOKEN>
x-asdev-user-id: admin-1
x-asdev-workspace-id: w1
x-asdev-role: ADMIN

{"templateId":"service-booking-reminder"}
```

Response (`201`):

```json
{
  "id": "c722258d-bb70-4e09-a3db-060f2d6194ec",
  "workspaceId": "w1",
  "name": "Service Booking + Reminder",
  "activeVersion": 1,
  "versions": [
    {
      "version": 1,
      "dslJson": {
        "name": "Booking Reminder"
      }
    }
  ]
}
```

## Principle
Everything must be observable (Run/StepRun).
