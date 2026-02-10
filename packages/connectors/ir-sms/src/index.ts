type SmsActionInput = {
  to: string;
  message: string;
  sender?: string;
};

type SmsContext = {
  idempotencyKey: string;
  config?: {
    apiKey?: string;
    apiBaseUrl?: string;
  };
  httpPost?: (
    url: string,
    body: URLSearchParams,
  ) => Promise<{
    status: number;
    json: () => Promise<unknown>;
  }>;
};

type KavenegarResponse = {
  return?: { status: number; message: string };
  entries?: Array<{ messageid?: number | string }>;
};

async function defaultPost(url: string, body: URLSearchParams) {
  const response = await fetch(url, { method: 'POST', body });
  return { status: response.status, json: async () => response.json() as Promise<unknown> };
}

export async function runAction(ctx: SmsContext, input: SmsActionInput) {
  const apiKey = ctx.config?.apiKey ?? process.env.KAVENEGAR_API_KEY;
  if (!apiKey) {
    return {
      output: {
        provider: 'mock',
        messageId: `sms_${ctx.idempotencyKey}`,
        to: input.to,
      },
    };
  }

  const baseUrl = ctx.config?.apiBaseUrl ?? 'https://api.kavenegar.com/v1';
  const endpoint = `${baseUrl}/${apiKey}/sms/send.json`;
  const post = ctx.httpPost ?? defaultPost;
  const payload = new URLSearchParams({
    receptor: input.to,
    message: input.message,
    ...(input.sender ? { sender: input.sender } : {}),
  });
  const response = await post(endpoint, payload);
  const data = (await response.json()) as KavenegarResponse;
  const status = data.return?.status ?? response.status;
  if (status !== 200) {
    throw new Error(`KAVENEGAR_SEND_FAILED:${status}`);
  }

  const messageId = data.entries?.[0]?.messageid;
  return {
    output: {
      provider: 'kavenegar',
      messageId: String(messageId ?? `sms_${ctx.idempotencyKey}`),
      to: input.to,
    },
  };
}
