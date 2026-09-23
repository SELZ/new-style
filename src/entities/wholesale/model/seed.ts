import type {
  Order,
  OrderStatus,
  Priority,
  State,
  StockProduct,
  User,
} from "./types.ts";

export const STATE_VERSION = 1;
export const STORAGE_KEY = "wholesale-workspace-v1";
export const DEMO_ACCOUNTS = [
  {
    email: "client@test.com",
    password: "demo123",
    role: "client",
    label: "Клиент",
  },
  {
    email: "worker1@test.com",
    password: "demo123",
    role: "warehouse_worker",
    label: "Склад напитков",
  },
  {
    email: "worker2@test.com",
    password: "demo123",
    role: "warehouse_worker",
    label: "Склад снеков",
  },
  {
    email: "worker3@test.com",
    password: "demo123",
    role: "warehouse_worker",
    label: "Склад бытовой химии",
  },
  {
    email: "manager@test.com",
    password: "demo123",
    role: "manager",
    label: "Менеджер",
  },
  {
    email: "admin@test.com",
    password: "demo123",
    role: "admin",
    label: "Администратор",
  },
] as const;

const permissions = (enabled = false) => ({
  manageUsers: enabled,
  manageWarehouses: enabled,
  manageProducts: enabled,
});

export function createSeed(now = Date.now()): State {
  const users: User[] = [
    {
      id: "u-client",
      email: "client@test.com",
      name: "Анна Смирнова",
      role: "client",
      warehouseIds: [],
      storeName: "Магазин «У дома»",
      tier: "regular",
    },
    {
      id: "u-worker-drinks",
      email: "worker1@test.com",
      name: "Иван Петров",
      role: "warehouse_worker",
      warehouseIds: ["wh-drinks"],
      storeName: "",
      tier: "new",
    },
    {
      id: "u-worker-snacks",
      email: "worker2@test.com",
      name: "Мария Волкова",
      role: "warehouse_worker",
      warehouseIds: ["wh-snacks"],
      storeName: "",
      tier: "new",
    },
    {
      id: "u-worker-chemicals",
      email: "worker3@test.com",
      name: "Алексей Соколов",
      role: "warehouse_worker",
      warehouseIds: ["wh-chemicals"],
      storeName: "",
      tier: "new",
    },
    {
      id: "u-manager",
      email: "manager@test.com",
      name: "Екатерина Орлова",
      role: "manager",
      warehouseIds: [],
      storeName: "",
      tier: "new",
    },
    {
      id: "u-admin",
      email: "admin@test.com",
      name: "Дмитрий Козлов",
      role: "admin",
      warehouseIds: [],
      storeName: "",
      tier: "new",
    },
    {
      id: "u-vip",
      email: "market@test.com",
      name: "Олег Морозов",
      role: "client",
      warehouseIds: [],
      storeName: "Сеть «Свежий маркет»",
      tier: "vip",
    },
    {
      id: "u-new",
      email: "cafe@test.com",
      name: "Елена Лебедева",
      role: "client",
      warehouseIds: [],
      storeName: "Кофейня «Пауза»",
      tier: "new",
    },
  ].map((user) => ({
    ...user,
    password: "demo123",
    active: true,
    phone: "+7 (900) 123-45-67",
    address: user.role === "client" ? "Москва, ул. Лесная, 12" : "",
    permissions: permissions(user.role === "admin" || user.role === "manager"),
  })) as User[];

  const warehouses = [
    {
      id: "wh-drinks",
      name: "Склад напитков",
      categories: ["Напитки"],
      color: "#3b82f6",
      rows: ["A", "B", "C"],
    },
    {
      id: "wh-snacks",
      name: "Склад снеков",
      categories: ["Снеки", "Другие товары"],
      color: "#f59e0b",
      rows: ["D", "E", "F"],
    },
    {
      id: "wh-chemicals",
      name: "Склад бытовой химии",
      categories: ["Бытовая химия"],
      color: "#8b5cf6",
      rows: ["G", "H", "J"],
    },
  ];

  const product = (
    id: string,
    name: string,
    category: string,
    warehouseId: string,
    price: number,
    stock: number,
    image: string,
    rack: string,
    shelf: number,
    unit = "уп.",
  ): StockProduct => ({
    id,
    name,
    category,
    warehouseId,
    price,
    stock,
    unit,
    image: `/products/${image}.svg`,
    location: { rack, shelf },
    available: stock > 0,
  });
  const products = [
    product(
      "p-juice",
      "Сок апельсиновый, 1 л × 12",
      "Напитки",
      "wh-drinks",
      1188,
      84,
      "orange",
      "A",
      1,
    ),
    product(
      "p-water",
      "Вода негазированная, 0,5 л × 12",
      "Напитки",
      "wh-drinks",
      348,
      210,
      "water",
      "A",
      2,
    ),
    product(
      "p-soda",
      "Лимонад «Лайм», 0,5 л × 12",
      "Напитки",
      "wh-drinks",
      780,
      65,
      "soda",
      "B",
      1,
    ),
    product(
      "p-apple",
      "Сок яблочный, 1 л × 12",
      "Напитки",
      "wh-drinks",
      1068,
      42,
      "juice",
      "B",
      2,
    ),
    product(
      "p-sparkling",
      "Вода газированная, 1,5 л × 6",
      "Напитки",
      "wh-drinks",
      294,
      9,
      "water",
      "C",
      1,
    ),
    product(
      "p-chips",
      "Чипсы картофельные, 90 г × 20",
      "Снеки",
      "wh-snacks",
      1560,
      73,
      "chips",
      "D",
      1,
    ),
    product(
      "p-crackers",
      "Крекеры солёные, 200 г × 12",
      "Снеки",
      "wh-snacks",
      816,
      91,
      "crackers",
      "D",
      2,
    ),
    product(
      "p-chocolate",
      "Шоколад молочный, 90 г × 24",
      "Снеки",
      "wh-snacks",
      2160,
      55,
      "chocolate",
      "E",
      1,
    ),
    product(
      "p-nuts",
      "Арахис жареный, 100 г × 20",
      "Снеки",
      "wh-snacks",
      1240,
      6,
      "nuts",
      "E",
      2,
    ),
    product(
      "p-cookies",
      "Печенье овсяное, 400 г × 10",
      "Снеки",
      "wh-snacks",
      950,
      0,
      "cookies",
      "F",
      1,
    ),
    product(
      "p-detergent",
      "Гель для стирки, 1,5 л × 6",
      "Бытовая химия",
      "wh-chemicals",
      2394,
      38,
      "detergent",
      "G",
      1,
    ),
    product(
      "p-cleaner",
      "Средство для посуды, 500 мл × 12",
      "Бытовая химия",
      "wh-chemicals",
      1188,
      96,
      "cleaner",
      "G",
      2,
    ),
    product(
      "p-soap",
      "Жидкое мыло, 300 мл × 12",
      "Бытовая химия",
      "wh-chemicals",
      948,
      62,
      "soap",
      "H",
      1,
    ),
    product(
      "p-floor",
      "Средство для пола, 1 л × 8",
      "Бытовая химия",
      "wh-chemicals",
      1432,
      24,
      "floor",
      "J",
      1,
    ),
    product(
      "p-towels",
      "Бумажные полотенца, 2 рулона × 12",
      "Другие товары",
      "wh-snacks",
      1296,
      35,
      "towels",
      "F",
      2,
    ),
    product(
      "p-napkins",
      "Салфетки бумажные, 100 шт. × 24",
      "Другие товары",
      "wh-snacks",
      720,
      125,
      "napkins",
      "F",
      3,
    ),
  ];

  const ago = (minutes: number) =>
    new Date(now - minutes * 60_000).toISOString();
  const seedOrder = (
    number: number,
    clientId: string,
    status: OrderStatus,
    priority: Priority,
    minutes: number,
    entries: [string, number][],
    hasShortage = false,
  ): Order => {
    const done = [
      "ready",
      "manager",
      "shipped",
      "completed",
    ].includes(status);
    const active = status === "picking";
    const items = entries.map(([productId, quantity], index) => {
      const p = products.find((item) => item.id === productId)!;
      return {
        id: `oi-${number}-${index}`,
        productId,
        name: p.name,
        image: p.image,
        unit: p.unit,
        warehouseId: p.warehouseId,
        quantity,
        price: p.price,
        picked: done
          ? quantity
          : active && index === 0
            ? Math.floor(quantity / 2)
            : 0,
        missing: 0,
      };
    });
    if (hasShortage) {
      items[0].picked -= 1;
      items[0].missing = 1;
    }
    const tasks = [...new Set(items.map((item) => item.warehouseId))].map(
      (warehouseId, index) => {
        const assignedTo = users.find(
          (user) =>
            user.role === "warehouse_worker" &&
            user.warehouseIds.includes(warehouseId),
        )!.id;
        return {
          id: `task-${number}-${index}`,
          warehouseId,
          status: done
            ? ("done" as const)
            : active
              ? ("picking" as const)
              : status === "accepted"
                ? ("accepted" as const)
                : ("new" as const),
          ...(status !== "new" ? { assignedTo } : {}),
          ...(active || done
            ? { startedAt: ago(Math.max(1, minutes - 8)) }
            : {}),
          ...(done ? { completedAt: ago(Math.max(1, minutes - 25)) } : {}),
        };
      },
    );
    return {
      id: `order-${number}`,
      number,
      clientId,
      createdAt: ago(minutes),
      updatedAt: ago(Math.max(1, minutes - 30)),
      status,
      priority,
      items,
      tasks,
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      address: "Москва, ул. Лесная, 12",
      comment:
        priority === "urgent"
          ? "Просьба подготовить к ближайшей отгрузке."
          : "",
    };
  };

  const orders = [
    seedOrder(1048, "u-client", "new", "normal", 6, [
      ["p-juice", 3],
      ["p-chips", 2],
    ]),
    seedOrder(1047, "u-vip", "picking", "vip", 52, [
      ["p-water", 8],
      ["p-soap", 3],
    ]),
    seedOrder(1046, "u-new", "accepted", "urgent", 28, [
      ["p-crackers", 4],
      ["p-towels", 2],
    ]),
    seedOrder(1045, "u-client", "ready", "normal", 82, [
      ["p-soda", 5],
      ["p-cleaner", 2],
    ], true),
    seedOrder(1044, "u-vip", "ready", "vip", 96, [
      ["p-chocolate", 6],
      ["p-detergent", 4],
    ]),
    seedOrder(1043, "u-client", "manager", "urgent", 122, [
      ["p-apple", 3],
      ["p-napkins", 2],
    ]),
    seedOrder(1042, "u-new", "shipped", "normal", 210, [
      ["p-water", 6],
      ["p-chips", 3],
    ]),
    seedOrder(1041, "u-client", "completed", "normal", 400, [
      ["p-juice", 2],
      ["p-soap", 2],
    ]),
    seedOrder(1040, "u-vip", "completed", "vip", 1440, [
      ["p-water", 10],
      ["p-crackers", 5],
    ]),
    seedOrder(1039, "u-new", "completed", "normal", 2880, [
      ["p-cleaner", 4],
      ["p-towels", 3],
    ]),
  ];
  return {
    version: STATE_VERSION,
    users,
    warehouses,
    products,
    orders,
    carts: {},
    sessionUserId: null,
    events: orders.map((order) => ({
      id: `event-${order.id}`,
      at: order.updatedAt,
      actorId: order.status === "new" ? order.clientId : "u-manager",
      message: `Заказ №${order.number}: ${order.status === "new" ? "создан клиентом" : "демонстрационный этап обработки"}`,
      orderId: order.id,
    })),
    notifications: [
      {
        id: "notice-client",
        userId: "u-client",
        at: ago(2),
        read: false,
        message: "Заказ №1045 собран с недостачей. Менеджер проверит состав.",
        orderId: "order-1045",
      },
      {
        id: "notice-manager",
        userId: "u-manager",
        at: ago(3),
        read: false,
        message: "Заказ №1044 готов к передаче менеджеру.",
        orderId: "order-1044",
      },
      {
        id: "notice-delay",
        userId: "u-manager",
        at: ago(1),
        read: false,
        message:
          "Заказ №1047 ожидает завершения сборки более 30 минут. Проверьте задания складов.",
        orderId: "order-1047",
      },
      {
        id: "notice-worker",
        userId: "u-worker-drinks",
        at: ago(6),
        read: false,
        message: "На склад напитков поступил заказ №1048.",
        orderId: "order-1048",
      },
    ],
  };
}
