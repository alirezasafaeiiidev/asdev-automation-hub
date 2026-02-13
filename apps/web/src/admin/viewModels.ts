import { ControlPlaneService } from '../service.js';
import { ActorContext, RunRecord } from '../types.js';

export async function getWorkflowsScreen(service: ControlPlaneService, actor: ActorContext) {
  const workflows = await service.listWorkflows(actor);
  return workflows.map((workflow) => ({
    id: workflow.id,
    name: workflow.name,
    active: workflow.isActive,
    latestVersion: workflow.versions.at(-1)?.version ?? 0,
    publishedAt: workflow.versions.at(-1)?.publishedAt ?? null,
  }));
}

export async function getRunsScreen(
  service: ControlPlaneService,
  actor: ActorContext,
  filter?: { status?: RunRecord['status']; workflowId?: string },
) {
  const runs = (await service.listRuns(actor, filter)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return runs.map((run) => ({
    id: run.id,
    workflowId: run.workflowId,
    workflowVersion: run.workflowVersion,
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  }));
}

export async function getConnectionsScreen(service: ControlPlaneService, actor: ActorContext) {
  const connections = await service.listConnections(actor);
  return connections.map((connection) => ({
    id: connection.id,
    provider: connection.provider,
    name: connection.name,
    maskedSecret: connection.maskedSecret,
  }));
}

export async function getAuditLogsScreen(service: ControlPlaneService, actor: ActorContext) {
  const logs = await service.listAuditLogs(actor);
  return logs.map((item) => ({
    at: item.createdAt,
    actorUserId: item.actorUserId,
    action: item.action,
    entityType: item.entityType,
    entityId: item.entityId,
  }));
}
