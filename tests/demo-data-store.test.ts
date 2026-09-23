import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { createDemoDataStore, DemoDataError } from "../tools/demo-data-store.ts";
import { createDemoDataMiddleware, demoDataPlugin, MAX_BODY_BYTES, WORKSPACE_PATH } from "../tools/demo-data-plugin.ts";

async function temporaryRoot(t: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), "wholesale-workspace-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function httpWorkspace(t: TestContext) {
  const root = await temporaryRoot(t);
  const store = createDemoDataStore(root);
  const middleware = createDemoDataMiddleware(store);
  const server = createServer((request, response) => middleware(request, response, () => {
    response.statusCode = 404;
    response.end("not found");
  }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { store, url: `http://127.0.0.1:${address.port}${WORKSPACE_PATH}` };
}

test("first read creates one revision-zero seed file and later stores reuse it", async (t) => {
  const root = await temporaryRoot(t);
  const store = createDemoDataStore(root);
  const first = await store.get();
  assert.equal(first.revision, 0);
  assert.equal(first.state.sessionUserId, null);
  assert.ok(first.state.users.some((user) => user.role === "admin"));
  assert.ok(first.state.orders.length > 0);
  assert.deepEqual(JSON.parse(await readFile(store.filePath, "utf8")), first);
  const restarted = createDemoDataStore(root);
  assert.deepEqual(await restarted.get(), first);
  assert.deepEqual(await readdir(path.join(root, "data")), ["demo-state.json"]);
});

test("roundtrip persists canonical state and advances revision while sessions remain browser-local", async (t) => {
  const root = await temporaryRoot(t);
  const store = createDemoDataStore(root);
  const input = await store.get();
  input.state.users[0].storeName = "Сохранённый магазин";
  input.state.products[0].stock += 10;
  input.state.sessionUserId = "u-admin";
  const saved = await store.put(input);
  assert.equal(saved.revision, 1);
  assert.equal(saved.state.sessionUserId, null);
  assert.equal(saved.state.users[0].storeName, "Сохранённый магазин");
  assert.equal(saved.state.products[0].stock, input.state.products[0].stock);
  assert.equal(input.state.sessionUserId, "u-admin", "Input object should not be mutated");
  assert.deepEqual(await createDemoDataStore(root).get(), saved);
  assert.deepEqual(JSON.parse(await readFile(store.filePath, "utf8")), saved);
});

test("invalid state/revision is rejected without overwriting the current document or poisoning the queue", async (t) => {
  const root = await temporaryRoot(t);
  const store = createDemoDataStore(root);
  const initial = await store.get();
  const before = await readFile(store.filePath, "utf8");
  for (const input of [null, [], {}, { revision: -1, state: initial.state }, { revision: 0.5, state: initial.state }, { revision: 0, state: {} }]) {
    await assert.rejects(store.put(input), (error: unknown) => error instanceof DemoDataError && error.status === 400);
    assert.equal(await readFile(store.filePath, "utf8"), before);
  }
  const saved = await store.put(initial);
  assert.equal(saved.revision, 1);
});

test("malformed existing JSON is preserved and produces a readable storage error", async (t) => {
  const root = await temporaryRoot(t);
  const store = createDemoDataStore(root);
  await mkdir(path.join(root, "data"), { recursive: true });
  const damaged = '{"revision":7,"state":';
  await writeFile(store.filePath, damaged, "utf8");
  await assert.rejects(store.get(), (error: unknown) => error instanceof DemoDataError && error.status === 500 && /повреждён/.test(error.message));
  assert.equal(await readFile(store.filePath, "utf8"), damaged);
  assert.deepEqual(await readdir(path.join(root, "data")), ["demo-state.json"]);
});

test("concurrent writers to one file produce one winner and return its snapshot with the conflict", async (t) => {
  const root = await temporaryRoot(t);
  const first = createDemoDataStore(root);
  const second = createDemoDataStore(root);
  const seeds = await Promise.all([first.get(), second.get()]);
  assert.deepEqual(seeds[0], seeds[1], "Concurrent initialization must not create different seeds");
  seeds[0].state.users[0].storeName = "Первое окно";
  seeds[1].state.users[0].storeName = "Второе окно";
  const results = await Promise.allSettled([first.put(seeds[0]), second.put(seeds[1])]);
  const successes = results.filter((result) => result.status === "fulfilled");
  const failures = results.filter((result) => result.status === "rejected");
  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  const saved = successes[0].value;
  const error: unknown = failures[0].reason;
  assert.ok(error instanceof DemoDataError);
  assert.equal(error.status, 409);
  assert.deepEqual(error.current, saved);
  assert.equal(saved.revision, 1);
  assert.deepEqual(await first.get(), saved);
  assert.deepEqual(JSON.parse(await readFile(first.filePath, "utf8")), saved);
});

test("atomic replacement keeps JSON readable while repeated writes are in progress", async (t) => {
  const root = await temporaryRoot(t);
  const store = createDemoDataStore(root);
  let document = await store.get();
  let finished = false;
  let reads = 0;
  const writes = (async () => {
    try {
      for (let index = 0; index < 15; index += 1) {
        document.state.users[0].storeName = `Запись ${index}`;
        document = await store.put(document);
      }
    } finally { finished = true; }
  })();
  const reader = (async () => {
    do {
      const snapshot = JSON.parse(await readFile(store.filePath, "utf8"));
      assert.ok(Number.isSafeInteger(snapshot.revision));
      assert.equal(snapshot.state.sessionUserId, null);
      assert.ok(Array.isArray(snapshot.state.products));
      reads += 1;
    } while (!finished);
  })();
  await Promise.all([writes, reader]);
  assert.ok(reads > 1, "Reader must observe the file during the write sequence");
  assert.equal(document.revision, 15);
  assert.equal((await store.get()).state.users[0].storeName, "Запись 14");
  assert.deepEqual(await readdir(path.join(root, "data")), ["demo-state.json"]);
});

test("HTTP contract supports GET/PUT, current snapshots on 409 and rejects malformed requests", async (t) => {
  const { store, url } = await httpWorkspace(t);
  const response = await fetch(`${url}?refresh=1`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  const initial = await response.json();
  const body = { ...initial, state: { ...initial.state, sessionUserId: "u-client" } };
  const saved = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(saved.status, 200);
  const current = await saved.json();
  assert.equal(current.revision, 1);
  assert.equal(current.state.sessionUserId, null);
  const stale = await fetch(url, { method: "PUT", body: JSON.stringify(initial) });
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), current);
  const invalid = await fetch(url, { method: "PUT", body: "{malformed" });
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /JSON/);
  const badState = await fetch(url, { method: "PUT", body: JSON.stringify({ revision: 1, state: {} }) });
  assert.equal(badState.status, 400);
  const unsupported = await fetch(url, { method: "POST", body: "{}" });
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.get("allow"), "GET, PUT");
  assert.equal((await fetch(`${url}/other`)).status, 404);
  assert.deepEqual(await store.get(), current);
});

test("HTTP body limit rejects oversized uploads without changing the document", async (t) => {
  const { store, url } = await httpWorkspace(t);
  const initial = await store.get();
  const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: "x".repeat(MAX_BODY_BYTES) }) });
  assert.equal(response.status, 413);
  assert.match((await response.json()).error, /8 МБ/);
  assert.deepEqual(await store.get(), initial);
});

test("the Vite plugin installs middleware for both development and preview using the resolved root", async (t) => {
  const root = await temporaryRoot(t);
  const plugin = demoDataPlugin();
  const installed: ReturnType<typeof createDemoDataMiddleware>[] = [];
  const server = { config: { root }, middlewares: { use(middleware: ReturnType<typeof createDemoDataMiddleware>) { installed.push(middleware); } } };
  for (const hook of [plugin.configureServer, plugin.configurePreviewServer]) {
    assert.equal(typeof hook, "function");
    (hook as (server: typeof server) => void)(server);
  }
  assert.equal(installed.length, 2);
  // Both hooks remain lazy: a build/config load must not create business data.
  await assert.rejects(readFile(path.join(root, "data", "demo-state.json")), { code: "ENOENT" });
});
