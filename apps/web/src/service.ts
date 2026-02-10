import { parseWorkflowDsl } from '@asdev/sdk';
import { randomUUID } from 'node:crypto';
import { InMemoryStore } from './repositories/inMemoryStore.js';
import { SecretCipher } from './security/secretCipher.js';
import { ActorContext, ConnectionRecord, RunRecord, StepRunRecord, WorkflowRecord } from './types.js';

function assertRole(actor: ActorContext, allowed: ActorContext['role'][]): void {
  if (!allowed.includes(actor.role)) {
    throw new Error(`RBAC_DENIED:${actor.role}`);
  }
}

export class ControlPlaneService {
  constructor(private readonly store: InMemoryStore, private readonly cipher: SecretCipher) {}

  createWorkflow(actor: ActorContext, name: string): WorkflowRecord {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR']);
    const workflow: WorkflowRecord = {
      id: randomUUID(),
      workspaceId: actor.workspaceId,
      name,
      isActive: false,
      versions: [],
    };
    this.store.workflows.set(workflow.id, workflow);
    this.audit(actor, 'workflow.create', 'Workflow', workflow.id);
    return workflow;
  }

  publishWorkflowVersion(actor: ActorContext, workflowId: string, dslJson: unknown): WorkflowRecord {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR']);
    const workflow = this.mustWorkflow(workflowId, actor.workspaceId);
    parseWorkflowDsl(dslJson);
    const nextVersion = workflow.versions.length + 1;
    workflow.versions.push({ version: nextVersion, dslJson, publishedAt: new Date().toISOString() });
    workflow.isActive = true;
    this.audit(actor, 'workflow.publish', 'WorkflowVersion', `${workflow.id}@${nextVersion}`);
    return workflow;
  }

  setWorkflowActive(actor: ActorContext, workflowId: string, isActive: boolean): WorkflowRecord {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR']);
    const workflow = this.mustWorkflow(workflowId, actor.workspaceId);
    workflow.isActive = isActive;
    this.audit(actor, 'workflow.set_active', 'Workflow', workflow.id);
    return workflow;
  }

  listWorkflows(actor: ActorContext): WorkflowRecord[] {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER']);
    return Array.from(this.store.workflows.values()).filter((workflow) => workflow.workspaceId === actor.workspaceId);
  }

  listRuns(
    actor: ActorContext,
    filter?: { workflowId?: string; status?: RunRecord['status'] },
  ): RunRecord[] {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER']);
    return Array.from(this.store.runs.values()).filter((run) => {
      if (run.workspaceId !== actor.workspaceId) {
        return false;
      }
      if (filter?.workflowId && run.workflowId !== filter.workflowId) {
        return false;
      }
      if (filter?.status && run.status !== filter.status) {
        return false;
      }
      return true;
    });
  }

  addRun(run: RunRecord): void {
    this.store.runs.set(run.id, run);
  }

  addStepLogs(runId: string, logs: StepRunRecord[]): void {
    this.store.stepRuns.set(runId, logs);
    const run = this.store.runs.get(runId);
    if (run) {
      run.updatedAt = new Date().toISOString();
    }
  }

  getRunTimeline(actor: ActorContext, runId: string): { run: RunRecord; steps: StepRunRecord[] } {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER']);
    const run = this.mustRun(runId, actor.workspaceId);
    return { run, steps: this.store.stepRuns.get(runId) ?? [] };
  }

  retryRun(actor: ActorContext, runId: string): RunRecord {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR']);
    const current = this.mustRun(runId, actor.workspaceId);
    const retried: RunRecord = {
      ...current,
      id: randomUUID(),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.runs.set(retried.id, retried);
    this.audit(actor, 'run.retry', 'Run', retried.id);
    return retried;
  }

  createConnection(actor: ActorContext, input: { name: string; provider: string; secret: string }): ConnectionRecord {
    assertRole(actor, ['OWNER', 'ADMIN']);
    const encryptedSecret = this.cipher.encrypt(input.secret);
    const connection: ConnectionRecord = {
      id: randomUUID(),
      workspaceId: actor.workspaceId,
      name: input.name,
      provider: input.provider,
      encryptedSecret,
    };
    this.store.connections.set(connection.id, connection);
    this.audit(actor, 'connection.create', 'Connection', connection.id);
    return connection;
  }

  listConnections(actor: ActorContext): Array<ConnectionRecord & { maskedSecret: string }> {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER']);
    return Array.from(this.store.connections.values())
      .filter((conn) => conn.workspaceId === actor.workspaceId)
      .map((conn) => {
        const plain = this.cipher.decrypt(conn.encryptedSecret);
        return { ...conn, maskedSecret: SecretCipher.mask(plain) };
      });
  }

  testConnection(
    actor: ActorContext,
    connectionId: string,
    tester?: (plainSecret: string, provider: string) => Promise<boolean>,
  ): Promise<{ ok: boolean }> {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR']);
    const connection = this.mustConnection(connectionId, actor.workspaceId);
    const plain = this.cipher.decrypt(connection.encryptedSecret);
    const runTest = tester ?? (async () => plain.length > 3);
    return runTest(plain, connection.provider).then((ok) => {
      this.audit(actor, 'connection.test', 'Connection', connectionId);
      return { ok };
    });
  }

  listAuditLogs(actor: ActorContext) {
    assertRole(actor, ['OWNER', 'ADMIN']);
    return this.store.audits.filter((entry) => entry.workspaceId === actor.workspaceId);
  }

  private audit(actor: ActorContext, action: string, entityType: string, entityId: string): void {
    this.store.audits.push({
      id: randomUUID(),
      workspaceId: actor.workspaceId,
      actorUserId: actor.userId,
      action,
      entityType,
      entityId,
      createdAt: new Date().toISOString(),
    });
  }

  private mustWorkflow(id: string, workspaceId: string): WorkflowRecord {
    const workflow = this.store.workflows.get(id);
    if (!workflow || workflow.workspaceId !== workspaceId) {
      throw new Error('WORKFLOW_NOT_FOUND');
    }
    return workflow;
  }

  private mustRun(id: string, workspaceId: string): RunRecord {
    const run = this.store.runs.get(id);
    if (!run || run.workspaceId !== workspaceId) {
      throw new Error('RUN_NOT_FOUND');
    }
    return run;
  }

  private mustConnection(id: string, workspaceId: string): ConnectionRecord {
    const conn = this.store.connections.get(id);
    if (!conn || conn.workspaceId !== workspaceId) {
      throw new Error('CONNECTION_NOT_FOUND');
    }
    return conn;
  }
}
