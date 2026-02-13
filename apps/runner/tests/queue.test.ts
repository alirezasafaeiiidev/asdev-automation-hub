import { describe, expect, it } from 'vitest';
import { InMemoryQueue } from '../src/queue/inMemoryQueue.js';
import { PostgresQueue } from '../src/queue/postgresQueue.js';

describe('in-memory queue', () => {
  it('claims by availability order and does not return an already claimed job', async () => {
    const queue = new InMemoryQueue();
    const now = new Date('2026-02-10T10:00:00Z');

    await queue.enqueue({
      id: 'j1',
      runId: 'r1',
      stepId: 's1',
      payload: {},
      availableAt: new Date('2026-02-10T10:00:01Z'),
      attempts: 0,
      maxAttempts: 3,
    });
    await queue.enqueue({
      id: 'j2',
      runId: 'r1',
      stepId: 's2',
      payload: {},
      availableAt: new Date('2026-02-10T09:59:59Z'),
      attempts: 0,
      maxAttempts: 3,
    });

    const first = await queue.claimNext(now);
    expect(first?.id).toBe('j2');
    const secondClaimBeforeAck = await queue.claimNext(now);
    expect(secondClaimBeforeAck).toBeNull();

    await queue.fail('j2', new Date('2026-02-10T10:10:00Z'));
    const second = await queue.claimNext(now);
    expect(second).toBeNull();
  });

  it('exposes skip locked claim query with unclaimed guard', () => {
    expect(PostgresQueue.claimSql()).toContain('FOR UPDATE SKIP LOCKED');
    expect(PostgresQueue.claimSql()).toContain('claimed_at IS NULL');
  });
});
