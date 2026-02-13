import { parseWorkflowDsl } from '@asdev/sdk';
import { randomUUID } from 'node:crypto';
import { ControlPlaneStore } from './repositories/controlPlaneStore.js';
import { SecretCipher } from './security/secretCipher.js';
import { ActorContext, AuditLogRecord, ConnectionRecord, RunRecord, StepRunRecord, WorkflowRecord } from './types.js';

function assertRole(actor: ActorContext, allowed: ActorContext['role'][]): void {
  if (!allowed.includes(actor.role)) {
    throw new Error(`RBAC_DENIED:${actor.role}`);
  }
}

export class ControlPlaneService {
  constructor(private readonly store: ControlPlaneStore, private readonly cipher: SecretCipher) {}

  async createWorkflow(actor: ActorContext, name: string): Promise<WorkflowRecord> {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR']);
    const workflow = await this.store.createWorkflow({
      id: randomUUID(),
      workspaceId: actor.workspaceId,
      name,
      createdById: actor.userId,
    });
    await this.audit(actor, 'workflow.create', 'Workflow', workflow.id);
    return workflow;
  }

  async publishWorkflowVersion(actor: ActorContext, workflowId: string, dslJson: unknown): Promise<WorkflowRecord> {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR']);
    await this.mustWorkflow(workflowId, actor.workspaceId);
    parseWorkflowDsl(dslJson);
    const workflow = await this.store.appendWorkflowVersion(
      workflowId,
      actor.workspaceId,
      dslJson,
      new Date().toISOString(),
    );
    if (!workflow) {
      throw new Error('WORKFLOW_NOT_FOUND');
    }
    const nextVersion = workflow.versions.at(-1)?.version ?? 1;
    await this.audit(actor, 'workflow.publish', 'WorkflowVersion', `${workflow.id}@${nextVersion}`);
    return workflow;
  }

  async setWorkflowActive(actor: ActorContext, workflowId: string, isActive: boolean): Promise<WorkflowRecord> {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR']);
    const workflow = await this.store.setWorkflowActive(workflowId, actor.workspaceId, isActive);
    if (!workflow) {
      throw new Error('WORKFLOW_NOT_FOUND');
    }
    await this.audit(actor, 'workflow.set_active', 'Workflow', workflow.id);
    return workflow;
  }

  listWorkflows(actor: ActorContext): Promise<WorkflowRecord[]> {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER']);
    return this.store.listWorkflows(actor.workspaceId);
  }

  listRuns(
    actor: ActorContext,
    filter?: { workflowId?: string; status?: RunRecord['status'] },
  ): Promise<RunRecord[]> {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER']);
    return this.store.listRuns(actor.workspaceId, filter);
  }

  addRun(run: RunRecord): Promise<void> {
    return this.store.addRun(run);
  }

  addStepLogs(runId: string, workspaceId: string, logs: StepRunRecord[]): Promise<void> {
    return this.store.replaceStepRuns(runId, workspaceId, logs);
  }

  async getRunTimeline(actor: ActorContext, runId: string): Promise<{ run: RunRecord; steps: StepRunRecord[] }> {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER']);
    const run = await this.mustRun(runId, actor.workspaceId);
    const steps = await this.store.getStepRuns(runId, actor.workspaceId);
    return { run, steps };
  }

  async retryRun(actor: ActorContext, runId: string): Promise<RunRecord> {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR']);
    const current = await this.mustRun(runId, actor.workspaceId);
    const retried: RunRecord = {
      ...current,
      id: randomUUID(),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.store.addRun(retried);
    await this.audit(actor, 'run.retry', 'Run', retried.id);
    return retried;
  }

  async createConnection(
    actor: ActorContext,
    input: { name: string; provider: string; secret: string },
  ): Promise<ConnectionRecord> {
    assertRole(actor, ['OWNER', 'ADMIN']);
    const encryptedSecret = this.cipher.encrypt(input.secret);
    const connection: ConnectionRecord = {
      id: randomUUID(),
      workspaceId: actor.workspaceId,
      name: input.name,
      provider: input.provider,
      encryptedSecret,
    };
    await this.store.createConnection(connection);
    await this.audit(actor, 'connection.create', 'Connection', connection.id);
    return connection;
  }

  async listConnections(actor: ActorContext): Promise<Array<ConnectionRecord & { maskedSecret: string }>> {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER']);
    const connections = await this.store.listConnections(actor.workspaceId);
    return connections
      .filter((conn) => conn.workspaceId === actor.workspaceId)
      .map((conn) => {
        const plain = this.cipher.decrypt(conn.encryptedSecret);
        return { ...conn, maskedSecret: SecretCipher.mask(plain) };
      });
  }

  async testConnection(
    actor: ActorContext,
    connectionId: string,
    tester?: (plainSecret: string, provider: string) => Promise<boolean>,
  ): Promise<{ ok: boolean }> {
    assertRole(actor, ['OWNER', 'ADMIN', 'OPERATOR']);
    const connection = await this.mustConnection(connectionId, actor.workspaceId);
    const plain = this.cipher.decrypt(connection.encryptedSecret);
    const runTest = tester ?? (async () => plain.length > 3);
    const ok = await runTest(plain, connection.provider);
    await this.audit(actor, 'connection.test', 'Connection', connectionId);
    return { ok };
  }

  listAuditLogs(actor: ActorContext): Promise<AuditLogRecord[]> {
    assertRole(actor, ['OWNER', 'ADMIN']);
    return this.store.listAuditLogs(actor.workspaceId);
  }

  private async audit(actor: ActorContext, action: string, entityType: string, entityId: string): Promise<void> {
    await this.store.addAuditLog({
      id: randomUUID(),
      workspaceId: actor.workspaceId,
      actorUserId: actor.userId,
      action,
      entityType,
      entityId,
      createdAt: new Date().toISOString(),
    });
  }

  private async mustWorkflow(id: string, workspaceId: string): Promise<WorkflowRecord> {
    const workflow = await this.store.getWorkflowById(id, workspaceId);
    if (!workflow) {
      throw new Error('WORKFLOW_NOT_FOUND');
    }
    return workflow;
  }

  private async mustRun(id: string, workspaceId: string): Promise<RunRecord> {
    const run = await this.store.getRun(id, workspaceId);
    if (!run) {
      throw new Error('RUN_NOT_FOUND');
    }
    return run;
  }

  private async mustConnection(id: string, workspaceId: string): Promise<ConnectionRecord> {
    const conn = await this.store.getConnection(id, workspaceId);
    if (!conn) {
      throw new Error('CONNECTION_NOT_FOUND');
    }
    return conn;
  }
}
