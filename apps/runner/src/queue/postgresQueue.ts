import type { Pool, PoolClient } from 'pg';
import { QueueJob, QueuePort } from './types.js';

const CLAIM_SQL = `
WITH next_job AS (
  SELECT id
  FROM queue_jobs
  WHERE available_at <= NOW() AND claimed_at IS NULL
  ORDER BY available_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE queue_jobs q
SET claimed_at = NOW()
FROM next_job
WHERE q.id = next_job.id
RETURNING q.id, q.run_id, q.step_id, q.payload, q.available_at, q.attempts, q.max_attempts;
`;

export class PostgresQueue implements QueuePort {
  constructor(private readonly pool: Pool) {}

  static claimSql(): string {
    return CLAIM_SQL;
  }

  async enqueue(job: QueueJob): Promise<void> {
    await this.pool.query(
      `INSERT INTO queue_jobs (id, run_id, step_id, payload, available_at, attempts, max_attempts)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
      [job.id, job.runId, job.stepId, JSON.stringify(job.payload), job.availableAt, job.attempts, job.maxAttempts],
    );
  }

  async claimNext(): Promise<QueueJob | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(CLAIM_SQL);
      await client.query('COMMIT');

      if (result.rowCount === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        runId: row.run_id,
        stepId: row.step_id,
        payload: row.payload,
        availableAt: row.available_at,
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async ack(jobId: string): Promise<void> {
    await this.pool.query('DELETE FROM queue_jobs WHERE id = $1', [jobId]);
  }

  async fail(jobId: string, nextAvailableAt: Date): Promise<void> {
    await this.pool.query('UPDATE queue_jobs SET attempts = attempts + 1, available_at = $2, claimed_at = NULL WHERE id = $1', [
      jobId,
      nextAvailableAt,
    ]);
  }
}

export async function withSerializableTransaction<T>(client: PoolClient, fn: () => Promise<T>): Promise<T> {
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try {
    const value = await fn();
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
