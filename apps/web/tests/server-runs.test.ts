import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { createServer, Server } from 'node:http';
import { buildServerContext, createRequestHandler } from '../src/server.js';

const ADMIN_API_TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';
const SECRET_KEY = '0123456789abcdef0123456789abcdef';
const ACTOR_HEADERS = {
  authorization: `Bearer ${ADMIN_API_TOKEN}`,
  'x-asdev-user-id': 'admin-1',
  'x-asdev-workspace-id': 'w1',
  'x-asdev-role': 'ADMIN',
};

describe('admin runs endpoints', () => {
  let server: Server;
  let baseUrl: string;
  let runId: string;

  beforeEach(async () => {
    const context = buildServerContext({
      SECRET_KEY,
      ADMIN_API_TOKEN,
    });

    const actor = { userId: 'admin-1', workspaceId: 'w1', role: 'ADMIN' as const };
    const workflow = await context.service.createWorkflow(actor, 'Order flow');
    await context.service.publishWorkflowVersion(actor, workflow.id, {
      name: 'Order flow',
      trigger: { type: 'core.form.submit', config: {} },
      steps: [{ id: 's1', connector: 'core.case', operation: 'create', input: {} }],
    });

    runId = randomUUID();
    await context.service.addRun({
      id: runId,
      workspaceId: 'w1',
      workflowId: workflow.id,
      workflowVersion: 1,
      status: 'FAILED',
      trigger: { orderId: 'o1' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await context.service.addStepLogs(runId, 'w1', [
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

    server = createServer(createRequestHandler(context));
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it('returns timeline for a run', async () => {
    const response = await fetch(`${baseUrl}/admin/runs/timeline?runId=${runId}`, {
      headers: ACTOR_HEADERS,
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      run: { id: string; status: string };
      steps: Array<{ runId: string; status: string }>;
    };

    expect(payload.run.id).toBe(runId);
    expect(payload.steps).toHaveLength(1);
    expect(payload.steps[0]?.runId).toBe(runId);
  });

  it('retries a failed run', async () => {
    const retryResponse = await fetch(`${baseUrl}/admin/runs/retry`, {
      method: 'POST',
      headers: {
        ...ACTOR_HEADERS,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ runId }),
    });

    expect(retryResponse.status).toBe(202);
    const retried = (await retryResponse.json()) as { id: string; status: string };
    expect(retried.status).toBe('PENDING');
    expect(retried.id).not.toBe(runId);

    const runsResponse = await fetch(`${baseUrl}/admin/runs`, {
      headers: ACTOR_HEADERS,
    });
    expect(runsResponse.status).toBe(200);
    const runs = (await runsResponse.json()) as Array<{ id: string }>;
    expect(runs.map((item) => item.id)).toContain(runId);
    expect(runs.map((item) => item.id)).toContain(retried.id);
  });
});
