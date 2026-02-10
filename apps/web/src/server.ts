import { createServer } from 'node:http';
import { InMemoryStore } from './repositories/inMemoryStore.js';
import { SecretCipher } from './security/secretCipher.js';
import { ControlPlaneService } from './service.js';
import { getConnectionsScreen, getRunsScreen, getWorkflowsScreen } from './admin/viewModels.js';
import { renderAdminPage } from './admin/page.js';

const service = new ControlPlaneService(new InMemoryStore(), new SecretCipher(process.env.SECRET_KEY ?? 'dev-secret'));
const actor = { userId: 'system', workspaceId: 'default', role: 'ADMIN' as const };
const port = Number(process.env.PORT ?? 3000);

createServer((req, res) => {
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

  if (url.pathname === '/admin/workflows') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(getWorkflowsScreen(service, actor)));
    return;
  }

  if (url.pathname === '/admin/runs') {
    const status = url.searchParams.get('status');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify(
        getRunsScreen(service, actor, {
          ...(status ? { status: status as 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' } : {}),
        }),
      ),
    );
    return;
  }

  if (url.pathname === '/admin/connections') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(getConnectionsScreen(service, actor)));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'NOT_FOUND' }));
}).listen(port, () => {
  console.log(`@asdev/web listening on :${port}`);
});
