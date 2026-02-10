type PaymentContext = {
  idempotencyKey: string;
  config?: {
    merchantId?: string;
    callbackUrl?: string;
    apiBaseUrl?: string;
  };
  httpPost?: (
    url: string,
    body: Record<string, unknown>,
  ) => Promise<{
    status: number;
    json: () => Promise<unknown>;
  }>;
};

type PaymentInput = {
  amount: string | number;
  description?: string;
  meta?: Record<string, unknown>;
};

type ZarinpalResponse = {
  data?: { authority?: string; code?: number; fee?: number };
  errors?: { code?: number; message?: string };
};

async function defaultPost(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: async () => response.json() as Promise<unknown> };
}

export async function runAction(ctx: PaymentContext, input: PaymentInput) {
  const merchantId = ctx.config?.merchantId ?? process.env.ZARINPAL_MERCHANT_ID;
  if (!merchantId) {
    return {
      output: {
        provider: 'mock',
        invoiceId: `inv_${ctx.idempotencyKey}`,
        payUrl: `https://local.pay/${input.amount}`,
      },
    };
  }

  const callbackUrl = ctx.config?.callbackUrl ?? process.env.ZARINPAL_CALLBACK_URL ?? 'https://localhost/callback';
  const endpoint = `${ctx.config?.apiBaseUrl ?? 'https://api.zarinpal.com'}/pg/v4/payment/request.json`;
  const payload = {
    merchant_id: merchantId,
    amount: Number(input.amount),
    callback_url: callbackUrl,
    description: input.description ?? 'asdev_lap payment request',
    metadata: input.meta ?? {},
  };

  const post = ctx.httpPost ?? defaultPost;
  const response = await post(endpoint, payload);
  const data = (await response.json()) as ZarinpalResponse;
  const code = data.data?.code ?? data.errors?.code ?? response.status;
  if (code !== 100) {
    throw new Error(`ZARINPAL_REQUEST_FAILED:${code}`);
  }

  const authority = data.data?.authority;
  if (!authority) {
    throw new Error('ZARINPAL_REQUEST_FAILED:NO_AUTHORITY');
  }

  return {
    output: {
      provider: 'zarinpal',
      invoiceId: authority,
      payUrl: `https://www.zarinpal.com/pg/StartPay/${authority}`,
      fee: data.data?.fee ?? 0,
    },
  };
}
