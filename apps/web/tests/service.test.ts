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
  it('creates workflow, publishes version, and records audit', async () => {
    const service = new ControlPlaneService(new InMemoryStore(), new SecretCipher('phase0-key'));
    const workflow = await service.createWorkflow(adminActor, 'Order flow');
    const updated = await service.publishWorkflowVersion(adminActor, workflow.id, {
      name: 'Order flow',
      trigger: { type: 'core.form.submit', config: {} },
      steps: [{ id: 's1', connector: 'core.case', operation: 'create', input: {} }],
    });

    expect(updated.versions).toHaveLength(1);
    const logs = await service.listAuditLogs(adminActor);
    expect(logs.length).toBeGreaterThan(0);
  });

  it('encrypts and masks connection secrets', async () => {
    const service = new ControlPlaneService(new InMemoryStore(), new SecretCipher('phase0-key'));
    await service.createConnection(adminActor, {
      name: 'payment',
      provider: 'ir.payment',
      secret: 'super-secret-token',
    });
    const connections = await service.listConnections(adminActor);
    expect(connections[0]?.maskedSecret).toContain('***');
  });

  it('enforces RBAC for sensitive actions', async () => {
    const service = new ControlPlaneService(new InMemoryStore(), new SecretCipher('phase0-key'));
    await expect(
      service.createConnection(viewerActor, {
        name: 'sms',
        provider: 'ir.sms',
        secret: 'x',
      }),
    ).rejects.toThrow(/RBAC_DENIED/);
  });

  it('installs template and exposes workflows on admin screen', async () => {
    const service = new ControlPlaneService(new InMemoryStore(), new SecretCipher('phase0-key'));
    const templateId = listTemplates()[0]?.id;
    if (!templateId) {
      throw new Error('template setup failed');
    }
    const workflow = await installTemplate(service, adminActor, templateId);
    expect(workflow.versions).toHaveLength(1);

    const workflows = await getWorkflowsScreen(service, adminActor);
    expect(workflows[0]?.active).toBe(true);
  });

  it('lists run timeline and supports retry', async () => {
    const service = new ControlPlaneService(new InMemoryStore(), new SecretCipher('phase0-key'));
    const runId = randomUUID();
    await service.addRun({
      id: runId,
      workspaceId: 'w1',
      workflowId: 'wf1',
      workflowVersion: 1,
      status: 'FAILED',
      trigger: { phone: '0912' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await service.addStepLogs(runId, 'w1', [
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

    const timeline = await service.getRunTimeline(adminActor, runId);
    expect(timeline.steps).toHaveLength(1);

    const retried = await service.retryRun(adminActor, runId);
    expect(retried.status).toBe('PENDING');

    const runs = await getRunsScreen(service, adminActor);
    expect(runs.length).toBe(2);
  });
});
