import { describe, expect, it } from 'vitest';
import { runAction } from '../src/index.js';

describe('payment connector', () => {
  it('returns deterministic invoice output in mock mode', async () => {
    const result = await runAction({ idempotencyKey: 'r1:s3' }, { amount: '1000' });
    expect(result.output.payUrl).toContain('/1000');
    expect(result.output.provider).toBe('mock');
  });

  it('maps zarinpal success payload', async () => {
    const result = await runAction(
      {
        idempotencyKey: 'r1:s3',
        config: { merchantId: 'merchant', apiBaseUrl: 'https://zarinpal.local' },
        httpPost: async () => ({
          status: 200,
          json: async () => ({
            data: { code: 100, authority: 'A123', fee: 0 },
          }),
        }),
      },
      { amount: 20000, description: 'invoice-1' },
    );
    expect(result.output.provider).toBe('zarinpal');
    expect(result.output.invoiceId).toBe('A123');
  });

  it('throws on provider failure code', async () => {
    await expect(
      runAction(
        {
          idempotencyKey: 'r1:s3',
          config: { merchantId: 'merchant' },
          httpPost: async () => ({
            status: 200,
            json: async () => ({
              errors: { code: -1, message: 'bad request' },
            }),
          }),
        },
        { amount: 20000 },
      ),
    ).rejects.toThrow(/ZARINPAL_REQUEST_FAILED/);
  });
});
