import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AddressInfo } from 'node:net';
import { createServer, Server } from 'node:http';
import { buildServerContext, createRequestHandler } from '../src/server.js';

const ADMIN_API_TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';
const SECRET_KEY = '0123456789abcdef0123456789abcdef';

describe('admin server auth', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const context = buildServerContext({
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

  it('returns 401 for admin endpoint when token is missing', async () => {
    const response = await fetch(`${baseUrl}/admin/workflows`);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'UNAUTHORIZED' });
  });

  it('returns 403 for non-admin role with valid token', async () => {
    const response = await fetch(`${baseUrl}/admin/workflows`, {
      headers: {
        authorization: `Bearer ${ADMIN_API_TOKEN}`,
        'x-asdev-user-id': 'viewer-1',
        'x-asdev-workspace-id': 'default',
        'x-asdev-role': 'VIEWER',
      },
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'FORBIDDEN' });
  });

  it('returns 200 for admin role with valid token', async () => {
    const response = await fetch(`${baseUrl}/admin/workflows`, {
      headers: {
        authorization: `Bearer ${ADMIN_API_TOKEN}`,
        'x-asdev-user-id': 'admin-1',
        'x-asdev-workspace-id': 'default',
        'x-asdev-role': 'ADMIN',
      },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it('fails fast when required env vars are missing', () => {
    expect(() => buildServerContext({ ADMIN_API_TOKEN })).toThrow(/SECRET_KEY/);
    expect(() => buildServerContext({ SECRET_KEY })).toThrow(/ADMIN_API_TOKEN/);
  });
});
