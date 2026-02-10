import { AuditLogRecord, ConnectionRecord, RunRecord, StepRunRecord, WorkflowRecord } from '../types.js';

export class InMemoryStore {
  workflows = new Map<string, WorkflowRecord>();
  runs = new Map<string, RunRecord>();
  stepRuns = new Map<string, StepRunRecord[]>();
  connections = new Map<string, ConnectionRecord>();
  audits: AuditLogRecord[] = [];
}
