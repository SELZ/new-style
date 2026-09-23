import { decodeState } from "./persistence.ts";
import { STORAGE_KEY } from "./seed.ts";
import type { State, StorageLike } from "./types.ts";
import type { WholesaleStore } from "./store.ts";

export const PENDING_FILE_KEY = "wholesale-pending-file-v1";
export interface FileSyncSnapshot {
  initialized: boolean;
  status: "loading" | "saved" | "saving" | "error" | "conflict" | "local";
  message: string;
}
interface Envelope {
  revision: number;
  state: State;
}
type SyncStore = Pick<WholesaleStore, "getState" | "syncStorage" | "subscribe">;
const sharedJson = (state: State) =>
  JSON.stringify({ ...state, sessionUserId: null });

function envelope(value: unknown): Envelope {
  if (!value || typeof value !== "object")
    throw new Error("Не удалось прочитать файл данных.");
  const record = value as Record<string, unknown>;
  const state = decodeState(JSON.stringify(record.state));
  if (
    !Number.isSafeInteger(record.revision) ||
    Number(record.revision) < 0 ||
    !state
  ) {
    throw new Error("Файл данных имеет неверный формат.");
  }
  return { revision: Number(record.revision), state };
}

/** Keeps the synchronous domain model responsive while serializing disk writes. */
export function createFileSync({
  store,
  fetcher,
  storage,
  endpoint = "/__demo/workspace",
}: {
  store: SyncStore;
  fetcher: typeof fetch;
  storage?: StorageLike;
  endpoint?: string;
}) {
  let snapshot: FileSyncSnapshot = {
    initialized: false,
    status: "loading",
    message: "Загружаем данные…",
  };
  let revision = 0;
  let saved = "";
  let desired = "";
  let applying = false;
  let started: Promise<void> | undefined;
  let writing: Promise<void> | undefined;
  let unsubscribe: (() => void) | undefined;
  const listeners = new Set<() => void>();
  function publish(patch: Partial<FileSyncSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  }
  function read(key: string) {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  function write(key: string, value: string) {
    try {
      storage?.setItem(key, value);
    } catch {
      /* The live model still retains the changes. */
    }
  }
  function clearPending() {
    try {
      storage?.removeItem?.(PENDING_FILE_KEY);
    } catch {
      /* Safe to retry the same snapshot after a reload. */
    }
  }
  function rememberPending() {
    if (desired && desired !== saved)
      write(
        PENDING_FILE_KEY,
        JSON.stringify({ revision, state: JSON.parse(desired) }),
      );
    else clearPending();
  }
  function apply(state: State) {
    const sessionUserId = store.getState().sessionUserId;
    const json = JSON.stringify({ ...state, sessionUserId });
    applying = true;
    try {
      store.syncStorage(json);
      write(STORAGE_KEY, JSON.stringify(store.getState()));
    } finally {
      applying = false;
    }
  }
  async function request(method = "GET", body?: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      return await fetcher(endpoint, {
        method,
        cache: "no-store",
        signal: controller.signal,
        ...(body
          ? {
              headers: { "Content-Type": "application/json" },
              body,
              keepalive: body.length < 60000,
            }
          : {}),
      });
    } finally {
      clearTimeout(timer);
    }
  }
  function observe() {
    unsubscribe ??= store.subscribe(() => {
      if (applying || snapshot.status === "local") return;
      const next = sharedJson(store.getState());
      if (next === desired) return;
      desired = next;
      rememberPending();
      if (snapshot.status !== "error" && snapshot.status !== "conflict")
        void flush();
    });
  }
  function flush(): Promise<void> {
    if (writing) return writing;
    if (
      !snapshot.initialized ||
      snapshot.status === "local" ||
      snapshot.status === "conflict"
    )
      return Promise.resolve();
    if (desired === saved) {
      publish({ status: "saved", message: "Все изменения сохранены" });
      return Promise.resolve();
    }
    publish({ status: "saving", message: "Сохраняем изменения…" });
    writing = (async () => {
      try {
        while (desired !== saved) {
          const candidate = desired;
          const response = await request(
            "PUT",
            JSON.stringify({ revision, state: JSON.parse(candidate) }),
          );
          if (response.status === 409) {
            const remote = envelope(await response.json());
            const actual = sharedJson(remote.state);
            if (actual === candidate || actual === desired) {
              revision = remote.revision;
              saved = actual;
              rememberPending();
              continue;
            }
            publish({
              status: "conflict",
              message:
                "Данные в файле изменены в другой вкладке. Ваши изменения сохранены в браузере.",
            });
            return;
          }
          if (!response.ok)
            throw new Error(
              "Файл не сохранён. Проверьте, что npm run dev продолжает работать, и повторите сохранение.",
            );
          const remote = envelope(await response.json());
          revision = remote.revision;
          saved = sharedJson(remote.state);
          if (saved !== candidate)
            throw new Error(
              "Сохранённые данные отличаются от отправленных. Изменения остались в браузере.",
            );
          rememberPending();
        }
        publish({ status: "saved", message: "Все изменения сохранены" });
      } catch (error) {
        publish({
          status: "error",
          message:
            error instanceof Error && error.name !== "AbortError"
              ? error.message
              : "Сервер не ответил. Изменения остались в браузере; повторите сохранение.",
        });
      }
    })().finally(() => {
      writing = undefined;
    });
    return writing;
  }
  async function initialize() {
    publish({ status: "loading", message: "Загружаем данные…" });
    try {
      const response = await request();
      // A static host has no local file service; browser persistence remains available.
      if (
        response.status === 404 ||
        (response.ok &&
          !response.headers.get("content-type")?.includes("application/json"))
      ) {
        publish({
          initialized: true,
          status: "local",
          message: "Данные сохраняются в этом браузере",
        });
        return;
      }
      if (!response.ok)
        throw new Error(
          "Не удалось открыть файл данных. Проверьте терминал с npm run dev и повторите загрузку.",
        );
      const remote = envelope(await response.json());
      revision = remote.revision;
      saved = sharedJson(remote.state);
      const pendingRaw = read(PENDING_FILE_KEY);
      let pending: Envelope | undefined;
      try {
        if (pendingRaw) pending = envelope(JSON.parse(pendingRaw));
      } catch {
        /* Ignore an invalid recovery record. */
      }
      const local = decodeState(read(STORAGE_KEY));
      if (pending && sharedJson(pending.state) !== saved) {
        desired = sharedJson(pending.state);
        apply(pending.state);
        observe();
        if (pending.revision !== revision) {
          publish({
            initialized: true,
            status: "conflict",
            message:
              "В браузере есть несохранённые изменения, а файл уже обновлён. Скачайте копию или загрузите данные из файла.",
          });
          return;
        }
      } else if (revision === 0 && local) {
        // Preserve orders made before file persistence was added.
        desired = sharedJson(local);
        apply(local);
        observe();
      } else {
        desired = saved;
        apply(remote.state);
        clearPending();
        observe();
      }
      publish({
        initialized: true,
        status: "saved",
        message: "Все изменения сохранены",
      });
      rememberPending();
      await flush();
    } catch (error) {
      publish({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось загрузить данные.",
      });
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      started ??= initialize();
      return started;
    },
    flush,
    async retry() {
      if (!snapshot.initialized) {
        started = initialize();
        await started;
      } else await flush();
    },
    /** Explicitly replace unsaved browser changes with the current file. */
    async reloadFromFile() {
      if (writing) await writing;
      try {
        const response = await request();
        if (!response.ok)
          throw new Error("Не удалось загрузить файл. Повторите попытку.");
        const remote = envelope(await response.json());
        revision = remote.revision;
        saved = sharedJson(remote.state);
        desired = saved;
        apply(remote.state);
        clearPending();
        publish({
          initialized: true,
          status: "saved",
          message: "Данные загружены из файла",
        });
      } catch (error) {
        publish({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось загрузить файл.",
        });
      }
    },
    downloadJson: () =>
      JSON.stringify(
        { revision, state: JSON.parse(sharedJson(store.getState())) },
        null,
        2,
      ),
    hasPending: () => desired !== saved,
    dispose() {
      unsubscribe?.();
      unsubscribe = undefined;
      listeners.clear();
    },
  };
}
