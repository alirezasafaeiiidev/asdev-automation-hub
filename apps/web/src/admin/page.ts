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
      .config { display: grid; gap: 8px; margin-bottom: 16px; background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
      .row { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
      label { font-size: 12px; color: #4a5568; display: grid; gap: 4px; }
      input, select { border: 1px solid #cbd5e0; border-radius: 6px; padding: 6px 8px; }
      button { border: 1px solid #2b6cb0; color: white; background: #2b6cb0; padding: 8px 10px; border-radius: 6px; cursor: pointer; width: fit-content; }
      pre { margin: 0; max-height: 220px; overflow: auto; font-size: 12px; }
    </style>
  </head>
  <body>
    <h1>asdev_lap Admin v0</h1>
    <div class="hint">Read-only operational view for workflows, runs, and connections. Configure admin headers below.</div>
    <section class="config">
      <div class="row">
        <label>Admin API Token
          <input id="token" type="password" placeholder="ADMIN_API_TOKEN" />
        </label>
        <label>User ID
          <input id="userId" type="text" placeholder="admin-user" />
        </label>
        <label>Workspace ID
          <input id="workspaceId" type="text" placeholder="default" />
        </label>
        <label>Role
          <select id="role">
            <option value="ADMIN">ADMIN</option>
            <option value="OWNER">OWNER</option>
          </select>
        </label>
      </div>
      <button id="save">Save and Reload Data</button>
    </section>
    <section class="grid">
      <article class="card"><h3>Workflows</h3><pre id="workflows">loading...</pre></article>
      <article class="card"><h3>Runs</h3><pre id="runs">loading...</pre></article>
      <article class="card"><h3>Connections</h3><pre id="connections">loading...</pre></article>
    </section>
    <script>
      const STORAGE_KEY = "asdev_admin_context";
      const saveBtn = document.getElementById("save");
      const tokenEl = document.getElementById("token");
      const userIdEl = document.getElementById("userId");
      const workspaceIdEl = document.getElementById("workspaceId");
      const roleEl = document.getElementById("role");

      function loadContext() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const parsed = raw ? JSON.parse(raw) : {};
          tokenEl.value = parsed.token || "";
          userIdEl.value = parsed.userId || "admin-user";
          workspaceIdEl.value = parsed.workspaceId || "default";
          roleEl.value = parsed.role || "ADMIN";
        } catch (_error) {
          userIdEl.value = "admin-user";
          workspaceIdEl.value = "default";
          roleEl.value = "ADMIN";
        }
      }

      function saveContext() {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            token: tokenEl.value,
            userId: userIdEl.value,
            workspaceId: workspaceIdEl.value,
            role: roleEl.value,
          }),
        );
      }

      function buildHeaders() {
        return {
          authorization: "Bearer " + tokenEl.value,
          "x-asdev-user-id": userIdEl.value,
          "x-asdev-workspace-id": workspaceIdEl.value,
          "x-asdev-role": roleEl.value,
        };
      }

      saveBtn.addEventListener("click", () => {
        saveContext();
        loadData();
      });

      const ids = ["workflows", "runs", "connections"];

      async function loadData() {
        try {
          await Promise.all(ids.map(async (id) => {
            const response = await fetch("/admin/" + id, { headers: buildHeaders() });
            const data = await response.json();
            document.getElementById(id).textContent = JSON.stringify(data, null, 2);
          }));
        } catch (error) {
          ids.forEach((id) => {
            document.getElementById(id).textContent = String(error);
          });
        }
      }

      loadContext();
      if (!tokenEl.value) {
        ids.forEach((id) => {
          document.getElementById(id).textContent = "Set admin context and click 'Save and Reload Data'.";
        });
      } else {
        loadData();
      }
    </script>
  </body>
</html>`;
}
