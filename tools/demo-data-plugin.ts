import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { createDemoDataStore, DemoDataError } from "./demo-data-store.ts";
import type { DemoDataStore } from "./demo-data-store.ts";

export const WORKSPACE_PATH = "/__demo/workspace";
export const MAX_BODY_BYTES = 8 * 1024 * 1024;

function json(response: ServerResponse, status: number, value: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(value));
}

function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    const cleanup = () => {
      request.removeListener("data", onData);
      request.removeListener("end", onEnd);
      request.removeListener("error", onError);
      request.removeListener("aborted", onAborted);
    };
    const fail = (error: Error) => { cleanup(); request.resume(); reject(error); };
    const onData = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += buffer.length;
      if (length > MAX_BODY_BYTES) return fail(new DemoDataError(413, "Размер данных превышает 8 МБ. Уменьшите фотографии товаров."));
      chunks.push(buffer);
    };
    const onEnd = () => {
      cleanup();
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new DemoDataError(400, "Ожидается корректный JSON.")); }
    };
    const onError = () => fail(new DemoDataError(400, "Не удалось прочитать запрос."));
    const onAborted = () => fail(new DemoDataError(400, "Запрос прерван."));
    if (Number(request.headers["content-length"]) > MAX_BODY_BYTES) {
      fail(new DemoDataError(413, "Размер данных превышает 8 МБ. Уменьшите фотографии товаров."));
      return;
    }
    request.on("data", onData);
    request.on("end", onEnd);
    request.on("error", onError);
    request.on("aborted", onAborted);
  });
}

export function createDemoDataMiddleware(store: DemoDataStore) {
  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (request.url?.split("?")[0] !== WORKSPACE_PATH) { next(); return; }
    const handle = async () => {
      if (request.method === "GET") {
        json(response, 200, await store.get());
      } else if (request.method === "PUT") {
        json(response, 200, await store.put(await readJson(request)));
      } else {
        response.setHeader("Allow", "GET, PUT");
        json(response, 405, { error: "Доступны только GET и PUT." });
      }
    };
    void handle().catch((error: unknown) => {
      if (response.destroyed || response.writableEnded) return;
      if (error instanceof DemoDataError) {
        json(response, error.status, error.current ?? { error: error.message });
      } else {
        json(response, 500, { error: "Не удалось прочитать или сохранить файл данных. Повторите попытку." });
      }
    });
  };
}

export function demoDataPlugin(): Plugin {
  return {
    name: "demo-workspace-json",
    config() {
      return { server: { watch: { ignored: ["**/data/demo-state.json", "**/data/demo-state.json.*.tmp"] } } };
    },
    configureServer(server) {
      server.middlewares.use(createDemoDataMiddleware(createDemoDataStore(server.config.root)));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createDemoDataMiddleware(createDemoDataStore(server.config.root)));
    },
  };
}
