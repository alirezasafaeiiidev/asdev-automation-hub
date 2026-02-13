import { describe, expect, it } from 'vitest';
import { executeWorkflow } from '../src/engine.js';

describe('runner engine', () => {
  it('executes linear steps with interpolation and idempotency key', async () => {
    const calls: string[] = [];
    const actionInputs: Array<Record<string, unknown>> = [];
    const result = await executeWorkflow({
      runId: 'run-1',
      trigger: { phone: '+989121234567' },
      dslJson: {
        name: 'flow',
        trigger: { type: 'core.form.submit', config: {} },
        steps: [
          { id: 's1', connector: 'core.case', operation: 'create', input: { id: 'case-1' } },
          {
            id: 's2',
            connector: 'ir.sms',
            operation: 'send',
            input: { to: '{{trigger.phone}}', ref: '{{s1.output.id}}' },
          },
        ],
      },
      connectorRuntime: {
        async runAction(input) {
          calls.push(input.idempotencyKey);
          actionInputs.push(input.input);
          if (input.operation === 'create') return { output: { id: 'case-1' } };
          return { output: { delivered: true, to: input.input.to } };
        },
      },
    });

    expect(result.status).toBe('SUCCEEDED');
    expect(calls).toEqual(['run-1:s1', 'run-1:s2']);
    expect(result.logs).toHaveLength(2);
    expect(actionInputs[1]?.ref).toBe('case-1');
  });

  it('retries then fails when attempts are exhausted', async () => {
    const result = await executeWorkflow({
      runId: 'run-2',
      trigger: {},
      dslJson: {
        name: 'failing-flow',
        trigger: { type: 't', config: {} },
        steps: [
          {
            id: 's1',
            connector: 'core.http',
            operation: 'post',
            input: {},
            policy: { maxAttempts: 2, backoffMs: 0, timeoutMs: 5000 },
          },
        ],
      },
      connectorRuntime: {
        async runAction() {
          throw new Error('temporary failure');
        },
      },
    });

    expect(result.status).toBe('FAILED');
    expect(result.logs).toHaveLength(2);
    expect(result.logs[1]?.status).toBe('FAILED');
  });
});
