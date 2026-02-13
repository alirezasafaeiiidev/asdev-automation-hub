import { AuditLogRecord, ConnectionRecord, RunRecord, StepRunRecord, WorkflowRecord } from '../types.js';
import { ControlPlaneStore, RunFilter } from './controlPlaneStore.js';

export class InMemoryStore implements ControlPlaneStore {
  private readonly workflows = new Map<string, WorkflowRecord>();
  private readonly runs = new Map<string, RunRecord>();
  private readonly stepRuns = new Map<string, StepRunRecord[]>();
  private readonly connections = new Map<string, ConnectionRecord>();
  private readonly audits: AuditLogRecord[] = [];

  async createWorkflow(input: {
    id: string;
    workspaceId: string;
    name: string;
    createdById: string;
  }): Promise<WorkflowRecord> {
    const workflow: WorkflowRecord = {
      id: input.id,
      workspaceId: input.workspaceId,
      name: input.name,
      isActive: false,
      versions: [],
    };
    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  async getWorkflowById(workflowId: string, workspaceId: string): Promise<WorkflowRecord | null> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.workspaceId !== workspaceId) {
      return null;
    }
    return workflow;
  }

  async setWorkflowActive(workflowId: string, workspaceId: string, isActive: boolean): Promise<WorkflowRecord | null> {
    const workflow = await this.getWorkflowById(workflowId, workspaceId);
    if (!workflow) {
      return null;
    }
    workflow.isActive = isActive;
    return workflow;
  }

  async appendWorkflowVersion(
    workflowId: string,
    workspaceId: string,
    dslJson: unknown,
    publishedAt: string,
  ): Promise<WorkflowRecord | null> {
    const workflow = await this.getWorkflowById(workflowId, workspaceId);
    if (!workflow) {
      return null;
    }
    workflow.versions.push({
      version: workflow.versions.length + 1,
      dslJson,
      publishedAt,
    });
    workflow.isActive = true;
    return workflow;
  }

  async listWorkflows(workspaceId: string): Promise<WorkflowRecord[]> {
    return Array.from(this.workflows.values()).filter((workflow) => workflow.workspaceId === workspaceId);
  }

  async addRun(run: RunRecord): Promise<void> {
    this.runs.set(run.id, run);
  }

  async getRun(runId: string, workspaceId: string): Promise<RunRecord | null> {
    const run = this.runs.get(runId);
    if (!run || run.workspaceId !== workspaceId) {
      return null;
    }
    return run;
  }

  async listRuns(workspaceId: string, filter?: RunFilter): Promise<RunRecord[]> {
    return Array.from(this.runs.values()).filter((run) => {
      if (run.workspaceId !== workspaceId) {
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

  async replaceStepRuns(runId: string, workspaceId: string, logs: StepRunRecord[]): Promise<void> {
    this.stepRuns.set(runId, logs.map((item) => ({ ...item, workspaceId })));
    const run = this.runs.get(runId);
    if (run && run.workspaceId === workspaceId) {
      run.updatedAt = new Date().toISOString();
    }
  }

  async getStepRuns(runId: string, workspaceId: string): Promise<StepRunRecord[]> {
    const logs = this.stepRuns.get(runId) ?? [];
    return logs.filter((entry) => entry.workspaceId === workspaceId);
  }

  async createConnection(connection: ConnectionRecord): Promise<void> {
    this.connections.set(connection.id, connection);
  }

  async getConnection(connectionId: string, workspaceId: string): Promise<ConnectionRecord | null> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.workspaceId !== workspaceId) {
      return null;
    }
    return connection;
  }

  async listConnections(workspaceId: string): Promise<ConnectionRecord[]> {
    return Array.from(this.connections.values()).filter((conn) => conn.workspaceId === workspaceId);
  }

  async addAuditLog(log: AuditLogRecord): Promise<void> {
    this.audits.push(log);
  }

  async listAuditLogs(workspaceId: string): Promise<AuditLogRecord[]> {
    return this.audits.filter((entry) => entry.workspaceId === workspaceId);
  }
}
