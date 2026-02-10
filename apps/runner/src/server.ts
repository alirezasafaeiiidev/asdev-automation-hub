import { createServer } from 'node:http';
import { executeWorkflow } from './engine.js';
import { DefaultConnectorRuntime } from './runtime/defaultConnectorRuntime.js';

const port = Number(process.env.PORT ?? 4000);

createServer(async (req, res) => {
  if ((req.url ?? '') === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'runner' }));
    return;
  }

  if ((req.url ?? '') === '/execute' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
          runId: string;
          trigger: Record<string, unknown>;
          dslJson: unknown;
        };
        const result = await executeWorkflow({
          runId: payload.runId,
          trigger: payload.trigger,
          dslJson: payload.dslJson,
          connectorRuntime: new DefaultConnectorRuntime(),
        });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'invalid request',
          }),
        );
      }
    });
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'NOT_FOUND' }));
}).listen(port, () => {
  console.log(`@asdev/runner listening on :${port}`);
});
