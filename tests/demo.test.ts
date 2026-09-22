import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, createDemoFetch } from "../src/shared/api/index.ts";
import { createTestApi } from "./helpers/createTestApi.ts";

const createDemo = () =>
  createTestApi({ baseUrl: "/b2b", fetch: createDemoFetch() });

test("demo credentials authenticate only the synthetic accounts", async () => {
  const api = createDemo();
  await assert.rejects(
    api.login("demo", "wrong"),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
  await assert.rejects(api.catalog("unknown-token"));
  assert.equal((await api.login("demo", "demo123")).token, "demo:demo-session");
  assert.equal(
    (await api.login("manager", "manager123")).token,
    "manager:demo-session",
  );
});

test("demo supplies categories, search, details and authoritative cart totals", async () => {
  const api = createDemo();
  const { token } = await api.login("demo", "demo123");
  const root = await api.catalog(token);
  assert.equal(root.categories.length, 3);
  assert.deepEqual(root.products, []);
  const catalog = await api.catalog(token, root.categories[0].id);
  const product = catalog.products[0];
  assert.equal((await api.product(token, product.id)).product.id, product.id);
  assert.equal(
    (await api.search(token, "  БЕСПРОВОДНЫЕ   наушники ")).products[0].id,
    product.id,
  );
  await api.addToCart(token, product.id, 2);
  assert.equal((await api.cart(token)).amount, product.price! * 2);
  assert.equal((await api.cart(token)).items[0].lineTotal, product.price! * 2);
  await api.minusFromCart(token, product.id);
  assert.equal((await api.cart(token)).items[0].quantity, 1);
  await api.removeFromCart(token, product.id);
  assert.deepEqual((await api.cart(token)).items, []);
  await api.addToCart(token, product.id);
  await api.clearCart(token);
  assert.equal((await api.cart(token)).amount, 0);
});

test("demo carts are isolated by account and reset with the transport; no orders are submitted", async () => {
  const api = createDemo();
  const demo = await api.login("demo", "demo123");
  const manager = await api.login("manager", "manager123");
  await api.addToCart(demo.token, "101");
  assert.equal((await api.cart(manager.token)).items.length, 0);
  await assert.rejects(api.checkout(demo.token, { chz: 0, comment: "Demo" }));
  assert.equal((await api.cart(demo.token)).items.length, 1);
  const freshApi = createDemo();
  const freshDemo = await freshApi.login("demo", "demo123");
  assert.equal((await freshApi.cart(freshDemo.token)).items.length, 0);
});
