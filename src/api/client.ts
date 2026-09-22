import { createDemoFetch } from "./demo.ts";
import type {
  Cart,
  CartLine,
  Catalog,
  Category,
  Product,
  ProductDetail,
  Session,
} from "./types.ts";

type JsonRecord = Record<string, unknown>;
type ErrorCode =
  | "http"
  | "network"
  | "invalid-response"
  | "timeout"
  | "validation";

export class ApiError extends Error {
  readonly status: number | null;
  readonly code: ErrorCode;

  constructor(message: string, code: ErrorCode, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function getErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Не удалось выполнить запрос. Попробуйте ещё раз.";
}

function invalidResponse(): never {
  throw new ApiError(
    "Сервер вернул некорректный ответ. Попробуйте позже.",
    "invalid-response",
  );
}

function record(value: unknown): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    invalidResponse();
  return value as JsonRecord;
}

function list(value: unknown): unknown[] {
  // Uninitialized optional PHP arrays are encoded as null.
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) invalidResponse();
  return value;
}

function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return invalidResponse();
}

function requiredText(value: unknown): string {
  const result = text(value);
  if (!result.trim()) invalidResponse();
  return result;
}

function number(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed))
    return null;
  const result = Number(trimmed);
  return Number.isFinite(result) ? result : null;
}

function nonnegativeNumber(value: unknown): number | null {
  const result = number(value);
  return result !== null && result >= 0 ? result : null;
}

function requiredNumber(value: unknown): number {
  const result = nonnegativeNumber(value);
  if (result === null) invalidResponse();
  return result;
}

function actionId(value: unknown): string {
  const result = text(value);
  return result === "0" ? "" : result;
}

function normalizeProduct(value: unknown): Product {
  const row = record(value);
  const ratio = nonnegativeNumber(row.ratio);
  const action = actionId(row.aid);
  return {
    id: requiredText(row.id),
    name: requiredText(row.name),
    image: text(row.image),
    price: nonnegativeNumber(row.price),
    ratio: ratio !== null && ratio > 0 ? ratio : null,
    unit: text(row.ediz),
    priceOne: nonnegativeNumber(row.price_one),
    wholesalePrice: nonnegativeNumber(row.opt),
    wholesalePriceOne: nonnegativeNumber(row.opt_one),
    actionId: action,
    actionPrice: action ? nonnegativeNumber(row.aprice) : null,
    marked: (number(row.mark) ?? 0) > 0,
    bonus: nonnegativeNumber(row.bonus),
  };
}

function normalizeCategory(value: unknown): Category {
  const row = record(value);
  return {
    id: requiredText(row.id),
    name: requiredText(row.name),
    image: text(row.image),
    parent: text(row.parent),
  };
}

function normalizeCatalog(value: unknown, search: boolean): Catalog {
  const row = record(value);
  // A valid empty response still contains these keys; {} is not an empty catalog.
  if (!("products" in row) || (!search && !("group" in row))) invalidResponse();
  return {
    categories: search ? [] : list(row.group).map(normalizeCategory),
    products: list(row.products).map(normalizeProduct),
    tags: list(row.tags).map((tag) => requiredText(record(tag).vid)),
  };
}

function normalizeDetail(value: unknown): ProductDetail {
  const row = record(value);
  const images = list(row.img).map((value) => {
    const image = record(value);
    return { id: requiredText(image.id), url: requiredText(image.href) };
  });
  const product = normalizeProduct(row.product);
  if (!product.image) product.image = images[0]?.url ?? "";
  return {
    product,
    images,
    similars: list(row.similars).map(normalizeProduct),
  };
}

function normalizeCart(value: unknown): Cart {
  const row = record(value);
  if (!("products" in row)) invalidResponse();
  const items = list(row.products).map((value, index): CartLine => {
    const item = record(value);
    const id = requiredText(item.id);
    const action = actionId(item.action);
    const quantity = requiredNumber(item.count);
    if (quantity <= 0) invalidResponse();
    return {
      // The same product can be split into regular and promotion lines by PHP.
      key: `${index}:${id}:${action}`,
      productId: id,
      name: requiredText(item.name),
      image: text(item.image),
      quantity,
      lineTotal: requiredNumber(item.price),
      unit: text(item.ediz),
      actionId: action,
      discount:
        item.discount === undefined ||
        item.discount === null ||
        item.discount === ""
          ? 0
          : requiredNumber(item.discount),
    };
  });
  return {
    items,
    amount: requiredNumber(row.amount),
    bonus: nonnegativeNumber(row.bonus),
  };
}

interface ClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

function aborted(): DOMException {
  return new DOMException("Запрос отменён.", "AbortError");
}

function statusMessage(status: number, login: boolean): string {
  if (login && status === 400) return "Неверный телефон или пароль.";
  if (status === 401 || status === 403)
    return "Сессия недействительна. Войдите снова.";
  if (status === 400)
    return "Запрос отклонён сервером. Проверьте данные или войдите снова.";
  if (status === 404) return "Данные не найдены.";
  if (status >= 500) return "Сервер временно недоступен. Попробуйте позже.";
  return "Не удалось выполнить запрос. Попробуйте позже.";
}

export function createApiClient(options: ClientOptions = {}) {
  const configuredBase =
    options.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? "/b2b";
  const base = (configuredBase.trim() || "/b2b").replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? 15_000;

  async function request(
    path: string,
    parameters: Record<string, string>,
    signal?: AbortSignal,
    emptyResponse = false,
  ): Promise<unknown> {
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
      // PHP reads $_GET, including credentials and all cart mutations.
      // Keep URLs and response bodies out of application errors/logging.
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
        throw new ApiError(
          statusMessage(response.status, path === "auth"),
          "http",
          response.status,
        );
      }
      if (emptyResponse) {
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
        throw new ApiError(
          "Сервер не ответил вовремя. Попробуйте позже.",
          "timeout",
        );
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        "Не удалось связаться с сервером. Попробуйте позже.",
        "network",
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
    }
  }

  return {
    async login(
      phone: string,
      password: string,
      signal?: AbortSignal,
    ): Promise<Session> {
      const row = record(await request("auth", { phone, password }, signal));
      return { token: requiredText(row.token), kkt: text(row.kkt) };
    },

    async catalog(
      token: string,
      group = "0",
      signal?: AbortSignal,
    ): Promise<Catalog> {
      return normalizeCatalog(
        await request("catalog", { token, group }, signal),
        false,
      );
    },

    async search(
      token: string,
      q: string,
      signal?: AbortSignal,
    ): Promise<Catalog> {
      const normalized = q.trim().replace(/\s+/g, " ");
      if (!normalized || normalized.split(" ").length > 5) {
        throw new ApiError(
          "Введите от одного до пяти слов для поиска.",
          "validation",
        );
      }
      return normalizeCatalog(
        await request("search", { token, q: normalized }, signal),
        true,
      );
    },

    async product(
      token: string,
      id: string,
      signal?: AbortSignal,
    ): Promise<ProductDetail> {
      return normalizeDetail(
        await request("catalog/id", { token, product_id: id }, signal),
      );
    },

    async promotion(
      token: string,
      id: string,
      signal?: AbortSignal,
    ): Promise<ProductDetail> {
      return normalizeDetail(
        await request("catalog/act", { token, product_id: id }, signal),
      );
    },

    async cart(token: string, signal?: AbortSignal): Promise<Cart> {
      return normalizeCart(await request("cart", { token }, signal));
    },

    async addToCart(token: string, id: string, count = 1): Promise<void> {
      if (!Number.isSafeInteger(count) || count < 1) {
        throw new ApiError(
          "Количество должно быть целым положительным числом.",
          "validation",
        );
      }
      await request(
        "cart/add",
        { token, product_id: id, count: String(count) },
        undefined,
        true,
      );
    },

    async minusFromCart(token: string, id: string): Promise<void> {
      await request("cart/minus", { token, product_id: id }, undefined, true);
    },

    async removeFromCart(token: string, id: string): Promise<void> {
      await request(
        "cart/product_clear",
        { token, product_id: id },
        undefined,
        true,
      );
    },

    async clearCart(token: string): Promise<void> {
      await request("cart/clear", { token }, undefined, true);
    },

    /**
     * PHP adds chz to the user's existing discount and submits the active order.
     * The caller must choose the increment explicitly; cart.chz is not that increment.
     * Never retry automatically: the server provides no idempotency key.
     */
    async checkout(
      token: string,
      input: { chz: number; comment: string },
    ): Promise<{ orderId: string }> {
      if (!Number.isFinite(input.chz) || input.chz < 0) {
        throw new ApiError("Некорректное значение скидки.", "validation");
      }
      const row = record(
        await request("cart/clouse", {
          token,
          chz: String(input.chz),
          comment: input.comment,
        }),
      );
      return { orderId: requiredText(row.order_id) };
    },
  };
}

export const isDemoMode = import.meta.env?.VITE_DEMO_MODE === "true";
export const api = createApiClient(
  isDemoMode ? { baseUrl: "/b2b", fetch: createDemoFetch() } : {},
);
