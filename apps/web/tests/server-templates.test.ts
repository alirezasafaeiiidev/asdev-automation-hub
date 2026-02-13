import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AddressInfo } from 'node:net';
import { createServer, Server } from 'node:http';
import { buildServerContext, createRequestHandler } from '../src/server.js';

const ADMIN_API_TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';
const SECRET_KEY = '0123456789abcdef0123456789abcdef';
const ACTOR_HEADERS = {
  authorization: `Bearer ${ADMIN_API_TOKEN}`,
  'x-asdev-user-id': 'admin-1',
  'x-asdev-workspace-id': 'w1',
  'x-asdev-role': 'ADMIN',
};

describe('admin template endpoints', () => {
  let server: Server;
  let baseUrl: string;
  let context: ReturnType<typeof buildServerContext>;
  const actor = { userId: 'admin-1', workspaceId: 'w1', role: 'ADMIN' as const };

  beforeEach(async () => {
    context = buildServerContext({
      SECRET_KEY,
      ADMIN_API_TOKEN,
    });

    server = createServer(createRequestHandler(context));
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it('returns template preflight with missing connectors when connections do not exist', async () => {
    const response = await fetch(`${baseUrl}/admin/templates/preflight`, {
      method: 'POST',
      headers: {
        ...ACTOR_HEADERS,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ templateId: 'service-booking-reminder' }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ready: boolean;
      missingConnectors: string[];
      requirements: Array<{ connector: string }>;
    };
    expect(payload.ready).toBe(false);
    expect(payload.requirements.length).toBeGreaterThan(0);
    expect(payload.missingConnectors).toContain('ir.payment');
    expect(payload.missingConnectors).toContain('ir.sms');
  });

  it('lists available templates for the install wizard', async () => {
    const response = await fetch(`${baseUrl}/admin/templates`, {
      headers: ACTOR_HEADERS,
    });

    expect(response.status).toBe(200);
    const templates = (await response.json()) as Array<{
      id: string;
      name: string;
      category: string;
      description: string;
      dslJson?: unknown;
    }>;
    expect(templates.length).toBeGreaterThan(0);
    expect(templates[0]).toHaveProperty('id');
    expect(templates[0]).toHaveProperty('name');
    expect(templates[0]).toHaveProperty('category');
    expect(templates[0]).toHaveProperty('description');
    expect(templates[0]).not.toHaveProperty('dslJson');
  });

  it('installs a template after required connectors are created', async () => {
    const createConnection = async (name: string, provider: string) =>
      context.service.createConnection(actor, {
        name,
        provider,
        secret: `${provider}-secret-value`,
      });

    await createConnection('payment', 'ir.payment');
    await createConnection('sms', 'ir.sms');

    const preflightResponse = await fetch(`${baseUrl}/admin/templates/preflight`, {
      method: 'POST',
      headers: {
        ...ACTOR_HEADERS,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ templateId: 'service-booking-reminder' }),
    });
    const preflight = (await preflightResponse.json()) as { ready: boolean; missingConnectors: string[] };
    expect(preflight.ready).toBe(true);
    expect(preflight.missingConnectors).toHaveLength(0);

    const installResponse = await fetch(`${baseUrl}/admin/templates/install`, {
      method: 'POST',
      headers: {
        ...ACTOR_HEADERS,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ templateId: 'service-booking-reminder' }),
    });

    expect(installResponse.status).toBe(201);
    const workflow = (await installResponse.json()) as { id: string; versions: Array<{ version: number }> };
    expect(workflow.id.length).toBeGreaterThan(10);
    expect(workflow.versions).toHaveLength(1);
  });

  it('tests an existing connection through admin diagnostics endpoint', async () => {
    const created = await context.service.createConnection(actor, {
      name: 'payment',
      provider: 'ir.payment',
      secret: 'payment-secret-value',
    });

    const response = await fetch(`${baseUrl}/admin/connections/test`, {
      method: 'POST',
      headers: {
        ...ACTOR_HEADERS,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ connectionId: created.id }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
