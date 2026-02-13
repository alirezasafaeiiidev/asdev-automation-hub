import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { AuditLogRecord, ConnectionRecord, RunRecord, StepRunRecord, WorkflowRecord } from '../types.js';
import { ControlPlaneStore, RunFilter } from './controlPlaneStore.js';

type WorkflowRow = {
  id: string;
  workspaceId: string;
  name: string;
  isActive: boolean;
};

type WorkflowVersionRow = {
  version: number;
  dslJson: unknown;
  publishedAt: Date | null;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export class PostgresStore implements ControlPlaneStore {
  constructor(private readonly pool: Pool) {}

  async createWorkflow(input: {
    id: string;
    workspaceId: string;
    name: string;
    createdById: string;
  }): Promise<WorkflowRecord> {
    await this.pool.query(
      `INSERT INTO "Workflow" ("id", "workspaceId", "name", "createdById")
       VALUES ($1, $2, $3, $4)`,
      [input.id, input.workspaceId, input.name, input.createdById],
    );
    const workflow = await this.getWorkflowById(input.id, input.workspaceId);
    if (!workflow) {
      throw new Error('WORKFLOW_NOT_FOUND');
    }
    return workflow;
  }

  async getWorkflowById(workflowId: string, workspaceId: string): Promise<WorkflowRecord | null> {
    const workflowRes = await this.pool.query<WorkflowRow>(
      `SELECT "id", "workspaceId", "name", "isActive"
       FROM "Workflow"
       WHERE "id" = $1 AND "workspaceId" = $2
       LIMIT 1`,
      [workflowId, workspaceId],
    );
    if (workflowRes.rowCount === 0) {
      return null;
    }
    const row = workflowRes.rows[0];
    if (!row) {
      return null;
    }
    const versionsRes = await this.pool.query<WorkflowVersionRow>(
      `SELECT "version", "dslJson", "publishedAt"
       FROM "WorkflowVersion"
       WHERE "workflowId" = $1
       ORDER BY "version" ASC`,
      [workflowId],
    );
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      isActive: row.isActive,
      versions: versionsRes.rows.map((versionRow) => ({
        version: Number(versionRow.version),
        dslJson: versionRow.dslJson,
        publishedAt: versionRow.publishedAt ? toIso(versionRow.publishedAt) : null,
      })),
    };
  }

  async setWorkflowActive(workflowId: string, workspaceId: string, isActive: boolean): Promise<WorkflowRecord | null> {
    const result = await this.pool.query(
      `UPDATE "Workflow"
       SET "isActive" = $3
       WHERE "id" = $1 AND "workspaceId" = $2`,
      [workflowId, workspaceId, isActive],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return this.getWorkflowById(workflowId, workspaceId);
  }

  async appendWorkflowVersion(
    workflowId: string,
    workspaceId: string,
    dslJson: unknown,
    publishedAt: string,
  ): Promise<WorkflowRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const workflowRes = await client.query<{ id: string }>(
        `SELECT "id"
         FROM "Workflow"
         WHERE "id" = $1 AND "workspaceId" = $2
         FOR UPDATE`,
        [workflowId, workspaceId],
      );
      if (workflowRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      const nextVersionRes = await client.query<{ nextVersion: number }>(
        `SELECT COALESCE(MAX("version"), 0) + 1 AS "nextVersion"
         FROM "WorkflowVersion"
         WHERE "workflowId" = $1`,
        [workflowId],
      );
      const nextVersion = Number(nextVersionRes.rows[0]?.nextVersion ?? 1);
      await client.query(
        `INSERT INTO "WorkflowVersion" ("id", "workflowId", "version", "dslJson", "publishedAt")
         VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz)`,
        [randomUUID(), workflowId, nextVersion, JSON.stringify(dslJson), publishedAt],
      );
      await client.query(
        `UPDATE "Workflow"
         SET "isActive" = TRUE
         WHERE "id" = $1`,
        [workflowId],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.getWorkflowById(workflowId, workspaceId);
  }

  async listWorkflows(workspaceId: string): Promise<WorkflowRecord[]> {
    const result = await this.pool.query<{
      workflowId: string;
      workflowName: string;
      workflowIsActive: boolean;
      version: number | null;
      dslJson: unknown | null;
      publishedAt: Date | null;
    }>(
      `SELECT
         w."id" AS "workflowId",
         w."name" AS "workflowName",
         w."isActive" AS "workflowIsActive",
         v."version" AS "version",
         v."dslJson" AS "dslJson",
         v."publishedAt" AS "publishedAt"
       FROM "Workflow" w
       LEFT JOIN "WorkflowVersion" v ON v."workflowId" = w."id"
       WHERE w."workspaceId" = $1
       ORDER BY w."createdAt" DESC, v."version" ASC`,
      [workspaceId],
    );

    const workflows = new Map<string, WorkflowRecord>();
    for (const row of result.rows) {
      const current = workflows.get(row.workflowId);
      if (!current) {
        workflows.set(row.workflowId, {
          id: row.workflowId,
          workspaceId,
          name: row.workflowName,
          isActive: row.workflowIsActive,
          versions: [],
        });
      }
      if (row.version !== null) {
        const workflow = workflows.get(row.workflowId);
        if (!workflow) {
          continue;
        }
        workflow.versions.push({
          version: Number(row.version),
          dslJson: row.dslJson,
          publishedAt: row.publishedAt ? toIso(row.publishedAt) : null,
        });
      }
    }

    return Array.from(workflows.values());
  }

  async addRun(run: RunRecord): Promise<void> {
    const versionRes = await this.pool.query<{ id: string }>(
      `SELECT "id"
       FROM "WorkflowVersion"
       WHERE "workflowId" = $1 AND "version" = $2
       LIMIT 1`,
      [run.workflowId, run.workflowVersion],
    );
    if (versionRes.rowCount === 0) {
      throw new Error('WORKFLOW_VERSION_NOT_FOUND');
    }
    const workflowVersion = versionRes.rows[0];
    if (!workflowVersion) {
      throw new Error('WORKFLOW_VERSION_NOT_FOUND');
    }
    await this.pool.query(
      `INSERT INTO "Run"
       ("id", "workspaceId", "workflowId", "workflowVersionId", "status", "triggerPayload", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::"RunStatus", $6::jsonb, $7::timestamptz, $8::timestamptz)`,
      [
        run.id,
        run.workspaceId,
        run.workflowId,
        workflowVersion.id,
        run.status,
        JSON.stringify(run.trigger ?? {}),
        run.createdAt,
        run.updatedAt,
      ],
    );
  }

  async getRun(runId: string, workspaceId: string): Promise<RunRecord | null> {
    const result = await this.pool.query<{
      id: string;
      workspaceId: string;
      workflowId: string;
      workflowVersion: number;
      status: RunRecord['status'];
      triggerPayload: Record<string, unknown> | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT
         r."id",
         r."workspaceId",
         r."workflowId",
         v."version" AS "workflowVersion",
         r."status",
         r."triggerPayload",
         r."createdAt",
         r."updatedAt"
       FROM "Run" r
       JOIN "WorkflowVersion" v ON v."id" = r."workflowVersionId"
       WHERE r."id" = $1 AND r."workspaceId" = $2
       LIMIT 1`,
      [runId, workspaceId],
    );
    if (result.rowCount === 0) {
      return null;
    }
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      workflowId: row.workflowId,
      workflowVersion: Number(row.workflowVersion),
      status: row.status,
      trigger: row.triggerPayload ?? {},
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  async listRuns(workspaceId: string, filter?: RunFilter): Promise<RunRecord[]> {
    const values: Array<string> = [workspaceId];
    const conditions = [`r."workspaceId" = $1`];
    if (filter?.workflowId) {
      values.push(filter.workflowId);
      conditions.push(`r."workflowId" = $${values.length}`);
    }
    if (filter?.status) {
      values.push(filter.status);
      conditions.push(`r."status" = $${values.length}::"RunStatus"`);
    }

    const result = await this.pool.query<{
      id: string;
      workspaceId: string;
      workflowId: string;
      workflowVersion: number;
      status: RunRecord['status'];
      triggerPayload: Record<string, unknown> | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT
         r."id",
         r."workspaceId",
         r."workflowId",
         v."version" AS "workflowVersion",
         r."status",
         r."triggerPayload",
         r."createdAt",
         r."updatedAt"
       FROM "Run" r
       JOIN "WorkflowVersion" v ON v."id" = r."workflowVersionId"
       WHERE ${conditions.join(' AND ')}
       ORDER BY r."createdAt" DESC`,
      values,
    );

    return result.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      workflowId: row.workflowId,
      workflowVersion: Number(row.workflowVersion),
      status: row.status,
      trigger: row.triggerPayload ?? {},
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    }));
  }

  async replaceStepRuns(runId: string, workspaceId: string, logs: StepRunRecord[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const runRes = await client.query<{ id: string }>(
        `SELECT "id"
         FROM "Run"
         WHERE "id" = $1 AND "workspaceId" = $2
         LIMIT 1`,
        [runId, workspaceId],
      );
      if (runRes.rowCount === 0) {
        throw new Error('RUN_NOT_FOUND');
      }
      await client.query(`DELETE FROM "StepRun" WHERE "runId" = $1`, [runId]);
      for (const log of logs) {
        await client.query(
          `INSERT INTO "StepRun"
           ("id", "runId", "stepId", "status", "attempt", "outputJson", "errorMessage", "createdAt")
           VALUES ($1, $2, $3, $4::"StepStatus", $5, $6::jsonb, $7, $8::timestamptz)`,
          [
            log.id,
            runId,
            log.stepId,
            log.status,
            log.attempt,
            JSON.stringify(log.output ?? {}),
            log.errorMessage ?? null,
            log.createdAt,
          ],
        );
      }
      await client.query(
        `UPDATE "Run"
         SET "updatedAt" = NOW()
         WHERE "id" = $1`,
        [runId],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getStepRuns(runId: string, workspaceId: string): Promise<StepRunRecord[]> {
    const result = await this.pool.query<{
      id: string;
      runId: string;
      workspaceId: string;
      stepId: string;
      attempt: number;
      status: StepRunRecord['status'];
      outputJson: Record<string, unknown> | null;
      errorMessage: string | null;
      createdAt: Date;
    }>(
      `SELECT
         s."id",
         s."runId",
         r."workspaceId",
         s."stepId",
         s."attempt",
         s."status",
         s."outputJson",
         s."errorMessage",
         s."createdAt"
       FROM "StepRun" s
       JOIN "Run" r ON r."id" = s."runId"
       WHERE s."runId" = $1 AND r."workspaceId" = $2
       ORDER BY s."createdAt" ASC`,
      [runId, workspaceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      runId: row.runId,
      workspaceId: row.workspaceId,
      stepId: row.stepId,
      attempt: Number(row.attempt),
      status: row.status,
      ...(row.outputJson ? { output: row.outputJson } : {}),
      ...(row.errorMessage ? { errorMessage: row.errorMessage } : {}),
      createdAt: toIso(row.createdAt),
    }));
  }

  async createConnection(connection: ConnectionRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO "Connection" ("id", "workspaceId", "name", "provider", "encryptedSecret")
       VALUES ($1, $2, $3, $4, $5)`,
      [connection.id, connection.workspaceId, connection.name, connection.provider, connection.encryptedSecret],
    );
  }

  async getConnection(connectionId: string, workspaceId: string): Promise<ConnectionRecord | null> {
    const result = await this.pool.query<ConnectionRecord>(
      `SELECT "id", "workspaceId", "name", "provider", "encryptedSecret"
       FROM "Connection"
       WHERE "id" = $1 AND "workspaceId" = $2
       LIMIT 1`,
      [connectionId, workspaceId],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return result.rows[0] ?? null;
  }

  async listConnections(workspaceId: string): Promise<ConnectionRecord[]> {
    const result = await this.pool.query<ConnectionRecord>(
      `SELECT "id", "workspaceId", "name", "provider", "encryptedSecret"
       FROM "Connection"
       WHERE "workspaceId" = $1
       ORDER BY "createdAt" DESC`,
      [workspaceId],
    );
    return result.rows;
  }

  async addAuditLog(log: AuditLogRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO "AuditLog" ("id", "workspaceId", "actorUserId", "action", "entityType", "entityId", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)`,
      [log.id, log.workspaceId, log.actorUserId, log.action, log.entityType, log.entityId, log.createdAt],
    );
  }

  async listAuditLogs(workspaceId: string): Promise<AuditLogRecord[]> {
    const result = await this.pool.query<{
      id: string;
      workspaceId: string;
      actorUserId: string | null;
      action: string;
      entityType: string;
      entityId: string;
      createdAt: Date;
    }>(
      `SELECT "id", "workspaceId", "actorUserId", "action", "entityType", "entityId", "createdAt"
       FROM "AuditLog"
       WHERE "workspaceId" = $1
       ORDER BY "createdAt" DESC`,
      [workspaceId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      actorUserId: row.actorUserId ?? 'system',
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      createdAt: toIso(row.createdAt),
    }));
  }
}
