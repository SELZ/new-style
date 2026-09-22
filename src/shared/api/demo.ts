// Synthetic fixtures only. This transport never calls a server.
import { demoAccounts } from "../config/index.ts";

const categories = [
  { id: "10", name: "Электроника", image: "", parent: "0" },
  { id: "20", name: "Для дома", image: "", parent: "0" },
  { id: "30", name: "Аксессуары", image: "", parent: "0" },
];

const products = [
  {
    id: "101",
    group: "10",
    name: "Беспроводные наушники",
    image: "/images/headphones.jpg",
    price: "12990",
  },
  {
    id: "102",
    group: "10",
    name: "Портативная колонка",
    image: "/images/speaker.jpg",
    price: "6490",
  },
  {
    id: "201",
    group: "20",
    name: "Стул с мягкой спинкой",
    image: "/images/chair.jpg",
    price: "8490",
  },
  {
    id: "202",
    group: "20",
    name: "Настольная лампа",
    image: "/images/lamp.jpg",
    price: "3990",
  },
  {
    id: "301",
    group: "30",
    name: "Городской рюкзак",
    image: "/images/backpack.jpg",
    price: "5490",
  },
  {
    id: "302",
    group: "30",
    name: "Солнцезащитные очки",
    image: "/images/sunglasses.jpg",
    price: "3490",
  },
];

const productRow = (product: (typeof products)[number]) => ({
  id: product.id,
  name: product.name,
  image: product.image,
  price: product.price,
  price_one: product.price,
  ratio: "1",
  ediz: "шт",
  mark: "0",
  aid: "0",
  aprice: "",
  bonus: "0",
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export function createDemoFetch(): typeof globalThis.fetch {
  // Each account has its own cart; all demo state is discarded on page reload.
  const carts = new Map<string, Map<string, number>>();

  return async (input, init) => {
    const signal = init?.signal;
    if (signal?.aborted) throw new DOMException("Запрос отменён", "AbortError");
    const url = new URL(String(input), "http://demo.invalid");
    const path = url.pathname.replace(/^\/b2b\//, "").replace(/\/$/, "");
    const params = url.searchParams;
    if (init?.method !== "GET") return json(null, 405);

    if (path === "auth") {
      const account = demoAccounts.find(
        (item) =>
          item.login === params.get("phone") &&
          item.password === params.get("password"),
      );
      if (!account) return json(null, 400);
      const token = `${account.login}:demo-session`;
      if (!carts.has(token)) carts.set(token, new Map());
      return json({ token, kkt: "0" });
    }

    const cart = carts.get(params.get("token") ?? "");
    if (!cart) return json(null, 401);

    if (path === "catalog") {
      const group = params.get("group") ?? "0";
      return json({
        back: "Назад",
        group: categories.filter((item) => item.parent === group),
        products: products
          .filter((item) => item.group === group)
          .map(productRow),
        tags: null,
      });
    }
    if (path === "search") {
      const words = (params.get("q") ?? "")
        .toLocaleLowerCase("ru-RU")
        .split(/\s+/)
        .filter(Boolean);
      return json({
        products: products
          .filter((item) =>
            words.every((word) =>
              item.name.toLocaleLowerCase("ru-RU").includes(word),
            ),
          )
          .map(productRow),
        tags: null,
      });
    }
    if (path === "catalog/id" || path === "catalog/act") {
      const product = products.find(
        (item) => item.id === params.get("product_id"),
      );
      if (!product) return json(null, 404);
      return json({
        product: productRow(product),
        img: [{ id: "1", href: product.image }],
        similars:
          path === "catalog/act"
            ? []
            : products
                .filter(
                  (item) =>
                    item.group === product.group && item.id !== product.id,
                )
                .map(productRow),
      });
    }
    if (path === "cart") {
      const rows = [...cart].map(([id, count]) => {
        const product = products.find((item) => item.id === id)!;
        return {
          ...productRow(product),
          count: String(count),
          price: String(Number(product.price) * count),
          action: "0",
          discount: "0",
        };
      });
      return json({
        products: rows,
        amount: rows.reduce((sum, item) => sum + Number(item.price), 0),
        bonus: "0",
      });
    }
    if (path === "cart/clear") {
      cart.clear();
      return new Response("");
    }
    if (["cart/add", "cart/minus", "cart/product_clear"].includes(path)) {
      const id = params.get("product_id") ?? "";
      if (!products.some((item) => item.id === id)) return json(null, 404);
      if (path === "cart/add") {
        const count = Number(params.get("count"));
        if (!Number.isSafeInteger(count) || count < 1) return json(null, 400);
        cart.set(id, (cart.get(id) ?? 0) + count);
      } else if (path === "cart/minus" && (cart.get(id) ?? 0) > 1) {
        cart.set(id, cart.get(id)! - 1);
      } else {
        cart.delete(id);
      }
      return new Response("");
    }
    // Orders are never submitted in demo mode; unknown routes cannot reach PHP.
    return json(null, 501);
  };
}
