import { describe, expect, it } from 'vitest';
import { interpolateObject, parseWorkflowDsl } from '../src/index.js';

describe('dsl parser', () => {
  it('parses valid workflow', () => {
    const parsed = parseWorkflowDsl({
      name: 'Order flow',
      trigger: { type: 'core.form.submit', config: { formId: 'f1' } },
      steps: [{ id: 's1', connector: 'core.case', operation: 'create', input: {} }],
    });

    expect(parsed.steps).toHaveLength(1);
  });

  it('resolves interpolation tokens', () => {
    const output = interpolateObject(
      {
        text: '{{trigger.phone}} -> {{s1.output.id}} -> {{env.RUNTIME}}',
        legacy: '{{s1.id}}',
      },
      {
        trigger: { phone: '+989121234567' },
        steps: { s1: { output: { id: 'case_1' } } },
        env: { RUNTIME: 'test' },
      },
    );

    expect(output.text).toBe('+989121234567 -> case_1 -> test');
    expect(output.legacy).toBe('case_1');
  });

  it('preserves non-string types when value is a single token', () => {
    const output = interpolateObject(
      {
        triggerPayload: '{{trigger}}',
        stepOutput: '{{s1.output}}',
      },
      {
        trigger: { phone: '+989121234567', items: [{ sku: 'A1', qty: 1 }] },
        steps: { s1: { output: { id: 'case_1', ok: true } } },
        env: {},
      },
    );

    expect(output.triggerPayload).toEqual({ phone: '+989121234567', items: [{ sku: 'A1', qty: 1 }] });
    expect(output.stepOutput).toEqual({ id: 'case_1', ok: true });
  });
});
