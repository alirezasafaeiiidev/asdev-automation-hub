import { IncomingMessage } from 'node:http';
import { ActorContext, Role } from './types.js';

const ROLE_VALUES: Role[] = ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER'];
const ADMIN_ROLES: Role[] = ['OWNER', 'ADMIN'];

export type AdminAuthResult =
  | { ok: true; actor: ActorContext }
  | { ok: false; status: 401 | 403; error: 'UNAUTHORIZED' | 'FORBIDDEN' };

function readHeader(req: IncomingMessage, headerName: string): string | null {
  const header = req.headers[headerName];
  if (Array.isArray(header)) {
    return header[0] ?? null;
  }
  return header ?? null;
}

function normalizeRole(value: string | null): Role | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  if (ROLE_VALUES.includes(normalized as Role)) {
    return normalized as Role;
  }
  return null;
}

function readAuthToken(req: IncomingMessage): string | null {
  const authorizationHeader = readHeader(req, 'authorization');
  if (authorizationHeader?.startsWith('Bearer ')) {
    const token = authorizationHeader.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
  }
  const tokenHeader = readHeader(req, 'x-admin-api-token');
  if (tokenHeader?.trim()) {
    return tokenHeader.trim();
  }
  return null;
}

export function requireEnv(name: string, env: Record<string, string | undefined> = process.env): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function authorizeAdminRequest(req: IncomingMessage, adminApiToken: string): AdminAuthResult {
  const token = readAuthToken(req);
  if (!token || token !== adminApiToken) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED' };
  }

  const role = normalizeRole(readHeader(req, 'x-asdev-role'));
  const userId = readHeader(req, 'x-asdev-user-id')?.trim();
  const workspaceId = readHeader(req, 'x-asdev-workspace-id')?.trim();

  if (!role || !userId || !workspaceId) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED' };
  }

  if (!ADMIN_ROLES.includes(role)) {
    return { ok: false, status: 403, error: 'FORBIDDEN' };
  }

  return { ok: true, actor: { userId, workspaceId, role } };
}
