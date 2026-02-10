export type Role = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

export type ActorContext = {
  userId: string;
  workspaceId: string;
  role: Role;
};

export type WorkflowRecord = {
  id: string;
  workspaceId: string;
  name: string;
  isActive: boolean;
  versions: Array<{ version: number; dslJson: unknown; publishedAt: string | null }>;
};

export type RunRecord = {
  id: string;
  workspaceId: string;
  workflowId: string;
  workflowVersion: number;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  trigger: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ConnectionRecord = {
  id: string;
  workspaceId: string;
  name: string;
  provider: string;
  encryptedSecret: string;
};

export type AuditLogRecord = {
  id: string;
  workspaceId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};

export type StepRunRecord = {
  id: string;
  runId: string;
  workspaceId: string;
  stepId: string;
  attempt: number;
  status: 'SUCCEEDED' | 'FAILED';
  output?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: string;
};
