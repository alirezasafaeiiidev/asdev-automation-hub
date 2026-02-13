import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { InMemoryStore } from './repositories/inMemoryStore.js';
import { SecretCipher } from './security/secretCipher.js';
import { ControlPlaneService } from './service.js';
import { getConnectionsScreen, getRunsScreen, getWorkflowsScreen } from './admin/viewModels.js';
import { renderAdminPage } from './admin/page.js';
import { authorizeAdminRequest, requireEnv } from './auth.js';

export type ServerContext = {
  service: ControlPlaneService;
  adminApiToken: string;
};

export function buildServerContext(env: Record<string, string | undefined> = process.env): ServerContext {
  const secretKey = requireEnv('SECRET_KEY', env);
  const adminApiToken = requireEnv('ADMIN_API_TOKEN', env);
  const service = new ControlPlaneService(new InMemoryStore(), new SecretCipher(secretKey));
  return { service, adminApiToken };
}

export function createRequestHandler(context: ServerContext) {
  return (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
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

      if (url.pathname === '/admin/workflows') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(getWorkflowsScreen(context.service, authResult.actor)));
        return;
      }

      if (url.pathname === '/admin/runs') {
        const status = url.searchParams.get('status');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify(
            getRunsScreen(context.service, authResult.actor, {
              ...(status ? { status: status as 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' } : {}),
            }),
          ),
        );
        return;
      }

      if (url.pathname === '/admin/connections') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(getConnectionsScreen(context.service, authResult.actor)));
        return;
      }
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'NOT_FOUND' }));
  };
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
