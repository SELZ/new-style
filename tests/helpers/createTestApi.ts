import { createHttpClient, type HttpClientOptions } from "../../src/shared/api/index.ts";
// Import API modules directly: public entity barrels also export browser UI.
import { createProductApi } from "../../src/entities/product/api/product-api.ts";
import { createCartApi } from "../../src/entities/cart/api/cart-api.ts";
import { createSessionApi } from "../../src/entities/session/api/session-api.ts";

/** Test-only facade: production composes APIs through their domain slices. */
export function createTestApi(options: HttpClientOptions = {}) {
  const http = createHttpClient(options);
  return {
    ...createProductApi(http),
    ...createCartApi(http),
    ...createSessionApi(http),
  };
}
