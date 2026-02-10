import { describe, expect, it } from 'vitest';
import { executeWorkflow } from '../src/engine.js';
import { DefaultConnectorRuntime } from '../src/runtime/defaultConnectorRuntime.js';

describe('e2e smoke', () => {
  it('executes order -> invoice -> sms flow with phase-1 connectors', async () => {
    const runtime = new DefaultConnectorRuntime();
    const result = await executeWorkflow({
      runId: 'smoke-run-1',
      trigger: {
        phone: '09123456789',
        amount: 125000,
        items: [{ sku: 'A1', qty: 1 }],
      },
      dslJson: {
        name: 'Order -> Invoice -> SMS',
        trigger: { type: 'core.form.submit', config: { formId: 'order_form_1' } },
        steps: [
          {
            id: 's1',
            connector: 'core.case',
            operation: 'create',
            input: { type: 'ORDER', data: { phone: '{{trigger.phone}}', items: '{{trigger.items}}' } },
          },
          {
            id: 's2',
            connector: 'ir.payment',
            operation: 'createInvoice',
            input: { amount: '{{trigger.amount}}', meta: { caseId: '{{s1.output.id}}' } },
            policy: { timeoutMs: 10_000, maxAttempts: 2, backoffMs: 0 },
          },
          {
            id: 's3',
            connector: 'ir.sms',
            operation: 'send',
            input: { to: '{{trigger.phone}}', message: 'pay: {{s2.output.payUrl}}' },
          },
        ],
      },
      connectorRuntime: runtime,
    });

    expect(result.status).toBe('SUCCEEDED');
    expect(result.logs).toHaveLength(3);
    expect(result.logs[1]?.output?.provider).toBeDefined();
    expect(result.logs[2]?.output?.provider).toBeDefined();
  });
});
