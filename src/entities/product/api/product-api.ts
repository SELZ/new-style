import { ApiError, http, type HttpClient } from "../../../shared/api/index.ts";
import type { Catalog, ProductDetail } from "../model/types.ts";
import { normalizeCatalog, normalizeDetail } from "./normalize.ts";

export function createProductApi(client: HttpClient) {
  return {
    async catalog(token: string, group = "0", signal?: AbortSignal): Promise<Catalog> {
      return normalizeCatalog(await client.request("catalog", { token, group }, { signal }), false);
    },

    async search(token: string, q: string, signal?: AbortSignal): Promise<Catalog> {
      const normalized = q.trim().replace(/\s+/g, " ");
      if (!normalized || normalized.split(" ").length > 5) {
        throw new ApiError("Введите от одного до пяти слов для поиска.", "validation");
      }
      return normalizeCatalog(
        await client.request("search", { token, q: normalized }, { signal }),
        true,
      );
    },

    async product(token: string, id: string, signal?: AbortSignal): Promise<ProductDetail> {
      return normalizeDetail(
        await client.request("catalog/id", { token, product_id: id }, { signal }),
      );
    },

    async promotion(token: string, id: string, signal?: AbortSignal): Promise<ProductDetail> {
      return normalizeDetail(
        await client.request("catalog/act", { token, product_id: id }, { signal }),
      );
    },
  };
}

export const productApi = createProductApi(http);
