import { describe, expect, it } from 'vitest';
import { runAction } from '../src/index.js';

describe('sms connector', () => {
  it('returns deterministic id in mock mode', async () => {
    const result = await runAction({ idempotencyKey: 'r1:s2' }, { to: '09', message: 'hi' });
    expect(result.output.messageId).toContain('r1:s2');
    expect(result.output.provider).toBe('mock');
  });

  it('maps kavenegar success payload', async () => {
    const result = await runAction(
      {
        idempotencyKey: 'r1:s2',
        config: { apiKey: 'test-key', apiBaseUrl: 'https://kavenegar.local/v1' },
        httpPost: async () => ({
          status: 200,
          json: async () => ({
            return: { status: 200, message: 'ok' },
            entries: [{ messageid: 7788 }],
          }),
        }),
      },
      { to: '0912', message: 'hello' },
    );
    expect(result.output.provider).toBe('kavenegar');
    expect(result.output.messageId).toBe('7788');
  });

  it('throws when provider response is not successful', async () => {
    await expect(
      runAction(
        {
          idempotencyKey: 'r1:s2',
          config: { apiKey: 'test-key' },
          httpPost: async () => ({
            status: 500,
            json: async () => ({
              return: { status: 500, message: 'failed' },
              entries: [],
            }),
          }),
        },
        { to: '0912', message: 'hello' },
      ),
    ).rejects.toThrow(/KAVENEGAR_SEND_FAILED/);
  });
});
