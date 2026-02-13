import { QueueJob, QueuePort } from './types.js';

export class InMemoryQueue implements QueuePort {
  private readonly jobs = new Map<string, QueueJob>();
  private readonly claimed = new Set<string>();

  async enqueue(job: QueueJob): Promise<void> {
    this.jobs.set(job.id, { ...job });
  }

  async claimNext(now = new Date()): Promise<QueueJob | null> {
    const candidates = Array.from(this.jobs.values())
      .filter((job) => job.availableAt <= now && !this.claimed.has(job.id))
      .sort((a, b) => a.availableAt.getTime() - b.availableAt.getTime());

    const next = candidates[0] ?? null;
    if (next) {
      this.claimed.add(next.id);
    }
    return next;
  }

  async ack(jobId: string): Promise<void> {
    this.jobs.delete(jobId);
    this.claimed.delete(jobId);
  }

  async fail(jobId: string, nextAvailableAt: Date): Promise<void> {
    const current = this.jobs.get(jobId);
    if (!current) return;
    this.jobs.set(jobId, {
      ...current,
      attempts: current.attempts + 1,
      availableAt: nextAvailableAt,
    });
    this.claimed.delete(jobId);
  }
}
