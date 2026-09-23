import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { decodeState } from "../src/entities/wholesale/model/persistence.ts";
import { createSeed } from "../src/entities/wholesale/model/seed.ts";
import type { State } from "../src/entities/wholesale/model/types.ts";

export interface WorkspaceDocument {
  revision: number;
  state: State;
}

export class DemoDataError extends Error {
  status: number;
  current?: WorkspaceDocument;
  constructor(status: number, message: string, current?: WorkspaceDocument) {
    super(message);
    this.name = "DemoDataError";
    this.status = status;
    this.current = current;
  }
}

// Shared by plugin instances in this Node process, including dev/preview instances.
const queues = new Map<string, Promise<unknown>>();

function serialized<T>(file: string, operation: () => Promise<T>): Promise<T> {
  const previous = queues.get(file) ?? Promise.resolve();
  const next = previous.then(operation, operation);
  queues.set(file, next);
  void next.finally(() => {
    if (queues.get(file) === next) queues.delete(file);
  }).catch(() => {});
  return next;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalDocument(value: unknown, status: number): WorkspaceDocument {
  const invalid = () => new DemoDataError(status, status === 400
    ? "Некорректные данные рабочего пространства."
    : "Файл данных повреждён. Существующие данные не перезаписаны.");
  if (!object(value) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || !object(value.state)) throw invalid();
  const state = decodeState(JSON.stringify({ ...value.state, sessionUserId: null }));
  if (!state) throw invalid();
  // The shared document never chooses a logged-in browser account.
  state.sessionUserId = null;
  return { revision: Number(value.revision), state };
}

function isMissing(error: unknown): boolean {
  return object(error) && error.code === "ENOENT";
}

export function createDemoDataStore(projectRoot: string) {
  // Request bodies cannot choose either the directory or the filename.
  const filePath = path.resolve(projectRoot, "data", "demo-state.json");
  const directory = path.dirname(filePath);

  async function atomicWrite(document: WorkspaceDocument) {
    await mkdir(directory, { recursive: true });
    const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temporary, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify(document)}\n`, "utf8");
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporary, filePath);
    } finally {
      await handle?.close().catch(() => {});
      await unlink(temporary).catch((error: unknown) => { if (!isMissing(error)) throw error; });
    }
  }

  async function load(): Promise<WorkspaceDocument> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      if (!isMissing(error)) throw error;
      const initial = { revision: 0, state: createSeed() };
      initial.state.sessionUserId = null;
      await atomicWrite(initial);
      return initial;
    }
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch { throw new DemoDataError(500, "Файл данных повреждён. Существующие данные не перезаписаны."); }
    const document = canonicalDocument(parsed, 500);
    // Canonicalize legacy persisted sessions/migrations on the first read.
    if (JSON.stringify(parsed) !== JSON.stringify(document)) await atomicWrite(document);
    return document;
  }

  return {
    filePath,
    get(): Promise<WorkspaceDocument> {
      return serialized(filePath, load);
    },
    put(input: unknown): Promise<WorkspaceDocument> {
      return serialized(filePath, async () => {
        const proposed = canonicalDocument(input, 400);
        const current = await load();
        if (proposed.revision !== current.revision) {
          throw new DemoDataError(409, "Данные уже изменены в другом окне. Загрузите актуальную версию.", current);
        }
        if (!Number.isSafeInteger(current.revision + 1)) throw new DemoDataError(500, "Достигнут предел версий файла данных.");
        const next = { revision: current.revision + 1, state: proposed.state };
        await atomicWrite(next);
        return next;
      });
    },
  };
}

export type DemoDataStore = ReturnType<typeof createDemoDataStore>;
