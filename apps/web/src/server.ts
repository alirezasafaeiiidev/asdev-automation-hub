import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { Pool } from 'pg';
import { InMemoryStore } from './repositories/inMemoryStore.js';
import { PostgresStore } from './repositories/postgresStore.js';
import { SecretCipher } from './security/secretCipher.js';
import { ControlPlaneService } from './service.js';
import { getConnectionsScreen, getRunsScreen, getWorkflowsScreen } from './admin/viewModels.js';
import { renderAdminPage } from './admin/page.js';
import { authorizeAdminRequest, requireEnv } from './auth.js';
import { RunRecord } from './types.js';

export type ServerContext = {
  service: ControlPlaneService;
  adminApiToken: string;
};

const runStatuses: RunRecord['status'][] = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED'];

export function buildServerContext(env: Record<string, string | undefined> = process.env): ServerContext {
  const secretKey = requireEnv('SECRET_KEY', env);
  const adminApiToken = requireEnv('ADMIN_API_TOKEN', env);
  const usePostgresStore = env.CONTROL_PLANE_STORE === 'postgres' || Boolean(env.DATABASE_URL);
  const store = usePostgresStore
    ? new PostgresStore(
        new Pool({
          connectionString: requireEnv('DATABASE_URL', env),
          max: Number(env.POSTGRES_POOL_MAX ?? '10'),
        }),
      )
    : new InMemoryStore();
  const service = new ControlPlaneService(store, new SecretCipher(secretKey));
  return { service, adminApiToken };
}

export function createRequestHandler(context: ServerContext) {
  return (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
    void handleRequest(context, req, res).catch((error) => {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'INTERNAL_SERVER_ERROR',
        }),
      );
    });
  };
}

async function handleRequest(context: ServerContext, req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'web' }));
    return;
  }

  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(renderAdminPage());
    return;
  }

  if (url.pathname.startsWith('/admin/')) {
    const authResult = authorizeAdminRequest(req, context.adminApiToken);
    if (!authResult.ok) {
      res.writeHead(authResult.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: authResult.error }));
      return;
    }

    if (url.pathname === '/admin/workflows' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(await getWorkflowsScreen(context.service, authResult.actor)));
      return;
    }

    if (url.pathname === '/admin/runs' && req.method === 'GET') {
      const status = url.searchParams.get('status');
      const workflowId = url.searchParams.get('workflowId');
      const runFilter: { workflowId?: string; status?: RunRecord['status'] } = {};
      if (workflowId) {
        runFilter.workflowId = workflowId;
      }
      if (status && isRunStatus(status)) {
        runFilter.status = status;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(await getRunsScreen(context.service, authResult.actor, runFilter)));
      return;
    }

    if (url.pathname === '/admin/runs/timeline' && req.method === 'GET') {
      const runId = url.searchParams.get('runId');
      if (!runId) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'RUN_ID_REQUIRED' }));
        return;
      }
      try {
        const timeline = await context.service.getRunTimeline(authResult.actor, runId);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(timeline));
      } catch (error) {
        if (error instanceof Error && error.message === 'RUN_NOT_FOUND') {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'RUN_NOT_FOUND' }));
          return;
        }
        throw error;
      }
      return;
    }

    if (url.pathname === '/admin/runs/retry' && req.method === 'POST') {
      let body: Record<string, unknown>;
      try {
        body = await readJsonBody(req);
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_JSON' }));
        return;
      }
      const runId = body.runId;
      if (typeof runId !== 'string' || runId.length === 0) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'RUN_ID_REQUIRED' }));
        return;
      }
      try {
        const run = await context.service.retryRun(authResult.actor, runId);
        res.writeHead(202, { 'content-type': 'application/json' });
        res.end(JSON.stringify(run));
      } catch (error) {
        if (error instanceof Error && error.message === 'RUN_NOT_FOUND') {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'RUN_NOT_FOUND' }));
          return;
        }
        throw error;
      }
      return;
    }

    if (url.pathname === '/admin/connections' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(await getConnectionsScreen(context.service, authResult.actor)));
      return;
    }
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'NOT_FOUND' }));
}

function isRunStatus(value: string): value is RunRecord['status'] {
  return runStatuses.includes(value as RunRecord['status']);
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

export function startServer(env: Record<string, string | undefined> = process.env) {
  const context = buildServerContext(env);
  const port = Number(env.PORT ?? 3000);
  const server = createServer(createRequestHandler(context));
  server.listen(port, () => {
    console.log(`@asdev/web listening on :${port}`);
  });
  return server;
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
