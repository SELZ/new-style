import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, getErrorMessage } from "../src/shared/api/index.ts";
import { createTestApi } from "./helpers/createTestApi.ts";

const token = "79000000000:fake-token+&="; // Synthetic credentials only.

type Call = { url: string; init: RequestInit };

function mockClient(body: unknown, status = 200, baseUrl = "/b2b") {
  const calls: Call[] = [];
  const client = createTestApi({
    baseUrl,
    fetch: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(body === undefined ? "" : JSON.stringify(body), {
        status,
      });
    },
  });
  return { client, calls };
}

function expectRequest(
  call: Call,
  path: string,
  query: Record<string, string>,
) {
  const url = new URL(call.url, "https://frontend.test");
  assert.equal(url.pathname, path);
  assert.deepEqual(Object.fromEntries(url.searchParams), query);
  assert.equal(call.init.method, "GET");
  assert.equal(call.init.body, undefined);
  assert.equal(new Headers(call.init.headers).get("Authorization"), null);
  assert.equal(call.init.cache, "no-store");
  assert.equal(call.init.credentials, "omit");
  assert.equal(call.init.referrerPolicy, "no-referrer");
}

const phpProduct = {
  id: "00042",
  name: "Напиток «Лимон»",
  image: "https://images.test/product.jpg",
  price: "1200",
  ratio: "12",
  ediz: "шт",
  price_one: "100.00",
  opt: "1080",
  opt_one: "90",
  aid: "7",
  aprice: "960",
  mark: "1",
  bonus: "5",
};

test("login sends the actual PHP query and preserves reserved characters", async () => {
  const { client, calls } = mockClient({ token, kkt: "1" });
  const password = "пароль+ &?=#%";
  assert.deepEqual(await client.login("+7 900 000-00-00", password), {
    token,
    kkt: "1",
  });
  assert.equal(calls.length, 1);
  expectRequest(calls[0], "/b2b/auth/", {
    phone: "+7 900 000-00-00",
    password,
  });
});

test("catalog maps categories, tags and PHP numeric strings without losing IDs", async () => {
  const { client, calls } = mockClient({
    back: "Назад",
    group: [{ id: "0010", name: "Напитки", image: "", parent: "0" }],
    products: [phpProduct],
    tags: [{ vid: "Газированные" }],
  });
  const result = await client.catalog(token, "0010");
  expectRequest(calls[0], "/b2b/catalog/", { token, group: "0010" });
  assert.deepEqual(result.categories, [
    { id: "0010", name: "Напитки", image: "", parent: "0" },
  ]);
  assert.deepEqual(result.tags, ["Газированные"]);
  assert.deepEqual(result.products[0], {
    id: "00042",
    name: phpProduct.name,
    image: phpProduct.image,
    price: 1200,
    ratio: 12,
    unit: "шт",
    priceOne: 100,
    wholesalePrice: 1080,
    wholesalePriceOne: 90,
    actionId: "7",
    actionPrice: 960,
    marked: true,
    bonus: 5,
  });
});

test("root catalog sends group=0 and accepts PHP null arrays", async () => {
  const { client, calls } = mockClient({
    group: null,
    products: null,
    tags: null,
  });
  assert.deepEqual(await client.catalog(token), {
    categories: [],
    products: [],
    tags: [],
  });
  expectRequest(calls[0], "/b2b/catalog/", { token, group: "0" });
});

test("search sends q and never fabricates category membership", async () => {
  const q = "чай & кофе + лимон";
  const { client, calls } = mockClient({ products: [phpProduct], tags: null });
  const result = await client.search(token, q);
  assert.deepEqual(result.categories, []);
  assert.equal(result.products.length, 1);
  expectRequest(calls[0], "/b2b/search/", { token, q });
});

test("search normalizes whitespace to PHP literal-space word splitting", async () => {
  const { client, calls } = mockClient({ products: [], tags: null });
  await client.search(token, "  чай   зелёный\tс\nлимоном  ");
  expectRequest(calls[0], "/b2b/search/", {
    token,
    q: "чай зелёный с лимоном",
  });
  for (const invalid of ["", "   ", "один два три четыре пять шесть"]) {
    await assert.rejects(
      client.search(token, invalid),
      (error: unknown) =>
        error instanceof ApiError && error.code === "validation",
    );
  }
  assert.equal(calls.length, 1);
});

test("product and promotion send product_id and map img.href", async () => {
  const response = {
    product: {
      id: "00042",
      name: "Напиток",
      price: "1200",
      ratio: "12",
      price_one: "100",
      mark: "0",
    },
    img: [{ id: 1, href: "https://images.test/detail.jpg" }],
    similars: [phpProduct],
  };
  const { client, calls } = mockClient(response);
  for (const method of ["product", "promotion"] as const) {
    const result = await client[method](token, "00042");
    assert.equal(result.product.image, "https://images.test/detail.jpg");
    assert.equal(result.product.unit, ""); // catalog/id omits ediz entirely.
    assert.equal(result.product.wholesalePrice, null);
    assert.equal(result.product.actionId, "");
    assert.equal(result.product.actionPrice, null);
    assert.equal(result.product.marked, false);
    assert.deepEqual(result.images, [
      { id: "1", url: "https://images.test/detail.jpg" },
    ]);
    assert.equal(result.similars[0].id, "00042");
  }
  expectRequest(calls[0], "/b2b/catalog/id/", { token, product_id: "00042" });
  expectRequest(calls[1], "/b2b/catalog/act/", { token, product_id: "00042" });
});

test("missing optional detail lists and prices remain empty or unknown", async () => {
  const { client } = mockClient({
    product: { id: "1", name: "Товар" },
    img: null,
    similars: null,
  });
  const detail = await client.product(token, "1");
  assert.deepEqual(detail.images, []);
  assert.deepEqual(detail.similars, []);
  assert.equal(detail.product.price, null);
  assert.equal(detail.product.ratio, null);
  assert.equal(detail.product.bonus, null);
});

test("numeric normalization rejects partial numbers, nonfinite values and empty strings", async () => {
  for (const value of [
    "",
    " ",
    "12руб",
    "1,20",
    "NaN",
    "Infinity",
    "1e999",
    "0x10",
    true,
    {},
    null,
  ]) {
    const { client } = mockClient({
      group: [],
      products: [
        {
          id: "1",
          name: "Товар",
          price: value,
          ratio: value,
          price_one: value,
          opt: value,
          opt_one: value,
          bonus: value,
          aid: "7",
          aprice: value,
        },
      ],
    });
    const product = (await client.catalog(token)).products[0];
    for (const field of [
      "price",
      "ratio",
      "priceOne",
      "wholesalePrice",
      "wholesalePriceOne",
      "actionPrice",
      "bonus",
    ] as const) {
      assert.equal(product[field], null, `${field}: ${String(value)}`);
    }
  }
});

test("cart preserves promotion and regular rows with the same product ID and line totals", async () => {
  const common = {
    id: "42",
    name: "Товар",
    image: "",
    ediz: "уп",
    discount: "0",
  };
  const { client, calls } = mockClient({
    products: [
      { ...common, action: "7", price: "1600", count: "2" },
      { ...common, action: 0, price: "3000", count: "3" },
    ],
    amount: 4600,
    bonus: "4.60",
  });
  const cart = await client.cart(token);
  assert.equal(cart.items.length, 2);
  assert.equal(new Set(cart.items.map((item) => item.key)).size, 2);
  assert.deepEqual(
    cart.items.map((item) => item.productId),
    ["42", "42"],
  );
  assert.deepEqual(
    cart.items.map((item) => item.actionId),
    ["7", ""],
  );
  assert.deepEqual(
    cart.items.map((item) => item.quantity),
    [2, 3],
  );
  assert.deepEqual(
    cart.items.map((item) => item.lineTotal),
    [1600, 3000],
  );
  assert.equal(cart.amount, 4600);
  assert.equal(cart.bonus, 4.6);
  expectRequest(calls[0], "/b2b/cart/", { token });
});

test("empty cart accepts null products and zero server total", async () => {
  const { client } = mockClient({ products: null, amount: "0", bonus: null });
  assert.deepEqual(await client.cart(token), {
    items: [],
    amount: 0,
    bonus: null,
  });
});

test("all cart mutations use exact GET parameters and accept empty HTTP 200", async () => {
  const { client, calls } = mockClient(undefined);
  await client.addToCart(token, "00042");
  await client.addToCart(token, "00042", 3);
  await client.minusFromCart(token, "00042");
  await client.removeFromCart(token, "00042");
  await client.clearCart(token);
  assert.equal(calls.length, 5);
  expectRequest(calls[0], "/b2b/cart/add/", {
    token,
    product_id: "00042",
    count: "1",
  });
  expectRequest(calls[1], "/b2b/cart/add/", {
    token,
    product_id: "00042",
    count: "3",
  });
  expectRequest(calls[2], "/b2b/cart/minus/", { token, product_id: "00042" });
  expectRequest(calls[3], "/b2b/cart/product_clear/", {
    token,
    product_id: "00042",
  });
  expectRequest(calls[4], "/b2b/cart/clear/", { token });
});

test("invalid quantities never send a mutation", async () => {
  const { client, calls } = mockClient(undefined);
  for (const count of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    await assert.rejects(client.addToCart(token, "42", count), {
      code: "validation",
    });
  }
  assert.equal(calls.length, 0);
});

test("configured absolute and relative API paths preserve their prefixes", async () => {
  for (const base of [
    "https://api.test/nested/b2b/",
    "/nested/b2b/",
    "nested/b2b",
  ]) {
    const { client, calls } = mockClient(
      { products: [], group: [] },
      200,
      base,
    );
    await client.catalog(token);
    expectRequest(calls[0], "/nested/b2b/catalog/", { token, group: "0" });
    if (base.startsWith("https:"))
      assert.equal(new URL(calls[0].url).origin, "https://api.test");
  }
});

test("malformed success payloads are rejected instead of silently producing empty content", async () => {
  for (const payload of [
    null,
    [],
    {},
    { products: {}, group: [] },
    { products: [], group: "wrong" },
    { products: [{ id: "1" }], group: [] },
    { products: [], group: [], tags: ["wrong"] },
  ]) {
    const { client } = mockClient(payload);
    await assert.rejects(client.catalog(token), { code: "invalid-response" });
  }
  for (const payload of [
    null,
    {},
    { product: null },
    { product: { id: "1", name: "Товар" }, img: {} },
  ]) {
    const { client } = mockClient(payload);
    await assert.rejects(client.product(token, "1"), {
      code: "invalid-response",
    });
  }
  for (const payload of [{}, { token: "" }, { token: {} }]) {
    const { client } = mockClient(payload);
    await assert.rejects(client.login("phone", "password"), {
      code: "invalid-response",
    });
  }
});

test("unknown cart money and malformed quantities never become a zero total", async () => {
  for (const payload of [
    { products: [], amount: "invalid" },
    { products: [], amount: null },
    {
      products: [{ id: "1", name: "Товар", count: "2", price: "12руб" }],
      amount: 12,
    },
    {
      products: [{ id: "1", name: "Товар", count: "0", price: "12" }],
      amount: 12,
    },
  ]) {
    const { client } = mockClient(payload);
    await assert.rejects(client.cart(token), { code: "invalid-response" });
  }
});

test("HTTP and malformed JSON errors do not disclose URL credentials or PHP output", async () => {
  const secret = "password=secret&token=secret /srv/private/db.php";
  for (const status of [400, 401, 403, 500]) {
    const client = createTestApi({
      fetch: async () => new Response(secret, { status }),
    });
    await assert.rejects(client.cart(token), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.ok(!getErrorMessage(error).includes("secret"));
      assert.ok(!getErrorMessage(error).includes("db.php"));
      return true;
    });
  }
  const client = createTestApi({
    fetch: async () => new Response(`<html>${secret}</html>`),
  });
  await assert.rejects(client.catalog(token), { code: "invalid-response" });
  assert.ok(!getErrorMessage(new Error(secret)).includes("secret"));
});

test("unexpected mutation response and network failure are never automatically retried", async () => {
  let count = 0;
  const client = createTestApi({
    fetch: async () => {
      count += 1;
      throw new TypeError("Fetch failed for https://host/?password=secret");
    },
  });
  await assert.rejects(client.addToCart(token, "42"), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, "network");
    assert.ok(!error.message.includes("secret"));
    return true;
  });
  assert.equal(count, 1);
  const { client: nonempty, calls } = mockClient({ unexpected: "success" });
  await assert.rejects(nonempty.clearCart(token), { code: "invalid-response" });
  assert.equal(calls.length, 1);
});

test("read cancellation aborts fetch and does not leak a caller-provided reason", async () => {
  const controller = new AbortController();
  let requestSignal: AbortSignal | undefined;
  const client = createTestApi({
    fetch: async (_url, init) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener(
          "abort",
          () => reject(new Error("secret URL")),
          { once: true },
        );
      });
    },
  });
  const pending = client.search(token, "чай", controller.signal);
  controller.abort(new Error("secret caller reason"));
  await assert.rejects(pending, (error: unknown) => {
    assert.ok(error instanceof DOMException);
    assert.equal(error.name, "AbortError");
    assert.ok(!error.message.includes("secret"));
    return true;
  });
  assert.equal(requestSignal?.aborted, true);
  const { client: alreadyAborted, calls } = mockClient({
    group: [],
    products: [],
  });
  await assert.rejects(alreadyAborted.catalog(token, "0", controller.signal), {
    name: "AbortError",
  });
  assert.equal(calls.length, 0);
});

test("timeout aborts a stalled request and reports a safe error", async () => {
  let calls = 0;
  const client = createTestApi({
    timeoutMs: 10,
    fetch: async (_url, init) => {
      calls += 1;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    },
  });
  await assert.rejects(client.addToCart(token, "42"), { code: "timeout" });
  assert.equal(calls, 1);
});

test("checkout uses the PHP clouse spelling and an explicit increment without retries", async () => {
  const { client, calls } = mockClient({ order_id: "00123" });
  const comment = "Доставка: утро & вечер?";
  assert.deepEqual(await client.checkout(token, { chz: 0, comment }), {
    orderId: "00123",
  });
  expectRequest(calls[0], "/b2b/cart/clouse/", { token, chz: "0", comment });
  const { client: empty, calls: emptyCalls } = mockClient(undefined);
  await assert.rejects(empty.checkout(token, { chz: 0, comment: "" }), {
    code: "invalid-response",
  });
  assert.equal(emptyCalls.length, 1);
});
