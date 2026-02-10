import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ControlPlaneService } from '../src/service.js';
import { InMemoryStore } from '../src/repositories/inMemoryStore.js';
import { SecretCipher } from '../src/security/secretCipher.js';
import { getRunsScreen, getWorkflowsScreen } from '../src/admin/viewModels.js';
import { installTemplate, listTemplates } from '../src/templates/gallery.js';

const adminActor = { userId: 'u1', workspaceId: 'w1', role: 'ADMIN' as const };
const viewerActor = { userId: 'u2', workspaceId: 'w1', role: 'VIEWER' as const };

describe('control plane service', () => {
  it('creates workflow, publishes version, and records audit', () => {
    const service = new ControlPlaneService(new InMemoryStore(), new SecretCipher('phase0-key'));
    const workflow = service.createWorkflow(adminActor, 'Order flow');
    const updated = service.publishWorkflowVersion(adminActor, workflow.id, {
      name: 'Order flow',
      trigger: { type: 'core.form.submit', config: {} },
      steps: [{ id: 's1', connector: 'core.case', operation: 'create', input: {} }],
    });

    expect(updated.versions).toHaveLength(1);
    expect(service.listAuditLogs(adminActor).length).toBeGreaterThan(0);
  });

  it('encrypts and masks connection secrets', () => {
    const service = new ControlPlaneService(new InMemoryStore(), new SecretCipher('phase0-key'));
    service.createConnection(adminActor, {
      name: 'payment',
      provider: 'ir.payment',
      secret: 'super-secret-token',
    });
    const connections = service.listConnections(adminActor);
    expect(connections[0]?.maskedSecret).toContain('***');
  });

  it('enforces RBAC for sensitive actions', () => {
    const service = new ControlPlaneService(new InMemoryStore(), new SecretCipher('phase0-key'));
    expect(() =>
      service.createConnection(viewerActor, {
        name: 'sms',
        provider: 'ir.sms',
        secret: 'x',
      }),
    ).toThrow(/RBAC_DENIED/);
  });

  it('installs template and exposes workflows on admin screen', () => {
    const service = new ControlPlaneService(new InMemoryStore(), new SecretCipher('phase0-key'));
    const templateId = listTemplates()[0]?.id;
    if (!templateId) {
      throw new Error('template setup failed');
    }
    const workflow = installTemplate(service, adminActor, templateId);
    expect(workflow.versions).toHaveLength(1);

    const workflows = getWorkflowsScreen(service, adminActor);
    expect(workflows[0]?.active).toBe(true);
  });

  it('lists run timeline and supports retry', () => {
    const service = new ControlPlaneService(new InMemoryStore(), new SecretCipher('phase0-key'));
    const runId = randomUUID();
    service.addRun({
      id: runId,
      workspaceId: 'w1',
      workflowId: 'wf1',
      workflowVersion: 1,
      status: 'FAILED',
      trigger: { phone: '0912' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    service.addStepLogs(runId, [
      {
        id: randomUUID(),
        runId,
        workspaceId: 'w1',
        stepId: 's1',
        attempt: 1,
        status: 'FAILED',
        errorMessage: 'timeout',
        createdAt: new Date().toISOString(),
      },
    ]);

    const timeline = service.getRunTimeline(adminActor, runId);
    expect(timeline.steps).toHaveLength(1);

    const retried = service.retryRun(adminActor, runId);
    expect(retried.status).toBe('PENDING');

    const runs = getRunsScreen(service, adminActor);
    expect(runs.length).toBe(2);
  });
});
