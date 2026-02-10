export function renderAdminPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>asdev_lap Admin v0</title>
    <style>
      :root { color-scheme: light; font-family: "IBM Plex Sans", "Segoe UI", sans-serif; }
      body { margin: 24px; background: linear-gradient(120deg, #f7fafc, #edf2f7); color: #1a202c; }
      h1 { margin: 0 0 4px 0; }
      .hint { margin-bottom: 18px; color: #4a5568; }
      .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
      .card { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
      pre { margin: 0; max-height: 220px; overflow: auto; font-size: 12px; }
    </style>
  </head>
  <body>
    <h1>asdev_lap Admin v0</h1>
    <div class="hint">Read-only operational view for workflows, runs, and connections.</div>
    <section class="grid">
      <article class="card"><h3>Workflows</h3><pre id="workflows">loading...</pre></article>
      <article class="card"><h3>Runs</h3><pre id="runs">loading...</pre></article>
      <article class="card"><h3>Connections</h3><pre id="connections">loading...</pre></article>
    </section>
    <script>
      const ids = ["workflows", "runs", "connections"];
      Promise.all(ids.map(async (id) => {
        const response = await fetch("/admin/" + id);
        const data = await response.json();
        document.getElementById(id).textContent = JSON.stringify(data, null, 2);
      })).catch((error) => {
        ids.forEach((id) => {
          document.getElementById(id).textContent = String(error);
        });
      });
    </script>
  </body>
</html>`;
}
