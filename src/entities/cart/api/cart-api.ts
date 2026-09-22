import {
  ApiError, http, record, requiredText, type HttpClient,
} from "../../../shared/api/index.ts";
import type { Cart } from "../model/types.ts";
import { normalizeCart } from "./normalize.ts";

export function createCartApi(client: HttpClient) {
  return {
    async cart(token: string, signal?: AbortSignal): Promise<Cart> {
      return normalizeCart(await client.request("cart", { token }, { signal }));
    },

    async addToCart(token: string, id: string, count = 1): Promise<void> {
      if (!Number.isSafeInteger(count) || count < 1) {
        throw new ApiError("Количество должно быть целым положительным числом.", "validation");
      }
      await client.request(
        "cart/add",
        { token, product_id: id, count: String(count) },
        { response: "empty" },
      );
    },

    async minusFromCart(token: string, id: string): Promise<void> {
      await client.request("cart/minus", { token, product_id: id }, { response: "empty" });
    },

    async removeFromCart(token: string, id: string): Promise<void> {
      await client.request("cart/product_clear", { token, product_id: id }, { response: "empty" });
    },

    async clearCart(token: string): Promise<void> {
      await client.request("cart/clear", { token }, { response: "empty" });
    },

    /**
     * PHP adds chz to the existing discount and submits the active order.
     * Caller must choose the increment explicitly; cart.chz is not that increment.
     * No automatic retry: the server provides no idempotency key.
     */
    async checkout(token: string, input: { chz: number; comment: string }): Promise<{ orderId: string }> {
      if (!Number.isFinite(input.chz) || input.chz < 0) {
        throw new ApiError("Некорректное значение скидки.", "validation");
      }
      const row = record(await client.request("cart/clouse", {
        token,
        chz: String(input.chz),
        comment: input.comment,
      }));
      return { orderId: requiredText(row.order_id) };
    },
  };
}

export const cartApi = createCartApi(http);
