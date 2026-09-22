import { ApiError, invalidResponse } from "./errors.ts";

export interface HttpClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

export interface HttpRequestOptions {
  signal?: AbortSignal;
  response?: "json" | "empty";
}

export interface HttpClient {
  request(
    path: string,
    parameters: Record<string, string>,
    options?: HttpRequestOptions,
  ): Promise<unknown>;
}

function aborted(): DOMException {
  return new DOMException("Запрос отменён.", "AbortError");
}

function statusMessage(status: number): string {
  if (status === 401 || status === 403)
    return "Сессия недействительна. Войдите снова.";
  if (status === 400)
    return "Запрос отклонён сервером. Проверьте данные или войдите снова.";
  if (status === 404) return "Данные не найдены.";
  if (status >= 500) return "Сервер временно недоступен. Попробуйте позже.";
  return "Не удалось выполнить запрос. Попробуйте позже.";
}

/** GET query transport for the existing PHP contract. No automatic retries. */
export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const configuredBase =
    options.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? "/b2b";
  const base = (configuredBase.trim() || "/b2b").replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? 15_000;

  return {
    async request(path, parameters, requestOptions = {}) {
      const { signal, response: responseKind = "json" } = requestOptions;
      if (signal?.aborted) throw aborted();
      const controller = new AbortController();
      let timedOut = false;
      const cancel = () => controller.abort();
      signal?.addEventListener("abort", cancel, { once: true });
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      try {
        const query = new URLSearchParams(parameters);
        // PHP reads $_GET. Keep sensitive URLs and raw responses out of errors.
        const response = await (options.fetch ?? globalThis.fetch)(
          `${base}/${path}/?${query}`,
          {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
            credentials: "omit",
            referrerPolicy: "no-referrer",
            headers: { Accept: "application/json" },
          },
        );
        if (!response.ok) {
          throw new ApiError(statusMessage(response.status), "http", response.status);
        }
        if (responseKind === "empty") {
          if ((await response.text()).trim()) invalidResponse();
          return undefined;
        }
        try {
          return await response.json();
        } catch (error) {
          if (controller.signal.aborted) throw error;
          return invalidResponse();
        }
      } catch (error) {
        if (signal?.aborted) throw aborted();
        if (timedOut)
          throw new ApiError("Сервер не ответил вовремя. Попробуйте позже.", "timeout");
        if (error instanceof ApiError) throw error;
        throw new ApiError("Не удалось связаться с сервером. Попробуйте позже.", "network");
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", cancel);
      }
    },
  };
}
