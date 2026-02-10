import { runAction as runCoreAction } from '@asdev/connector-core';
import { runAction as runPaymentAction } from '@asdev/connector-ir-payment';
import { runAction as runSmsAction } from '@asdev/connector-ir-sms';
import { ConnectorRuntime, StepExecutionResult } from '../types.js';

function toStringRecord(input: Record<string, unknown>): Record<string, string> {
  return Object.entries(input).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = String(value ?? '');
    return acc;
  }, {});
}

export class DefaultConnectorRuntime implements ConnectorRuntime {
  async runAction(input: {
    connector: string;
    operation: string;
    connectionId?: string;
    input: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<StepExecutionResult> {
    if (input.connector === 'core.case' && input.operation === 'create') {
      return runCoreAction({ idempotencyKey: input.idempotencyKey }, input.input);
    }

    if (input.connector === 'ir.sms' && input.operation === 'send') {
      const smsInput = toStringRecord(input.input);
      const apiKey = process.env.IR_SMS_API_KEY;
      return runSmsAction(
        {
          idempotencyKey: input.idempotencyKey,
          ...(apiKey ? { config: { apiKey } } : {}),
        },
        {
          to: smsInput.to ?? '',
          message: smsInput.message ?? '',
          ...(smsInput.sender ? { sender: smsInput.sender } : {}),
        },
      );
    }

    if (input.connector === 'ir.payment' && input.operation === 'createInvoice') {
      const amount = input.input.amount;
      const numericAmount = typeof amount === 'number' ? amount : Number(amount ?? 0);
      const merchantId = process.env.IR_PAYMENT_MERCHANT_ID;
      const callbackUrl = process.env.IR_PAYMENT_CALLBACK_URL;
      const config =
        merchantId || callbackUrl
          ? {
              ...(merchantId ? { merchantId } : {}),
              ...(callbackUrl ? { callbackUrl } : {}),
            }
          : undefined;
      return runPaymentAction(
        {
          idempotencyKey: input.idempotencyKey,
          ...(config ? { config } : {}),
        },
        {
          amount: Number.isFinite(numericAmount) ? numericAmount : 0,
          meta: (input.input.meta as Record<string, unknown> | undefined) ?? {},
        },
      );
    }

    throw new Error(`UNSUPPORTED_CONNECTOR_OPERATION:${input.connector}:${input.operation}`);
  }
}
