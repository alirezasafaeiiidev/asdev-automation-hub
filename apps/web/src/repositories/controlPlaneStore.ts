import { AuditLogRecord, ConnectionRecord, RunRecord, StepRunRecord, WorkflowRecord } from '../types.js';

export type RunFilter = {
  workflowId?: string;
  status?: RunRecord['status'];
};

export type ControlPlaneStore = {
  createWorkflow(input: {
    id: string;
    workspaceId: string;
    name: string;
    createdById: string;
  }): Promise<WorkflowRecord>;
  getWorkflowById(workflowId: string, workspaceId: string): Promise<WorkflowRecord | null>;
  setWorkflowActive(workflowId: string, workspaceId: string, isActive: boolean): Promise<WorkflowRecord | null>;
  appendWorkflowVersion(
    workflowId: string,
    workspaceId: string,
    dslJson: unknown,
    publishedAt: string,
  ): Promise<WorkflowRecord | null>;
  listWorkflows(workspaceId: string): Promise<WorkflowRecord[]>;

  addRun(run: RunRecord): Promise<void>;
  getRun(runId: string, workspaceId: string): Promise<RunRecord | null>;
  listRuns(workspaceId: string, filter?: RunFilter): Promise<RunRecord[]>;
  replaceStepRuns(runId: string, workspaceId: string, logs: StepRunRecord[]): Promise<void>;
  getStepRuns(runId: string, workspaceId: string): Promise<StepRunRecord[]>;

  createConnection(connection: ConnectionRecord): Promise<void>;
  getConnection(connectionId: string, workspaceId: string): Promise<ConnectionRecord | null>;
  listConnections(workspaceId: string): Promise<ConnectionRecord[]>;

  addAuditLog(log: AuditLogRecord): Promise<void>;
  listAuditLogs(workspaceId: string): Promise<AuditLogRecord[]>;
};
