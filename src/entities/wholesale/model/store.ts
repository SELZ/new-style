import type {
  Order,
  OrderItem,
  Priority,
  ProductInput,
  ProfilePatch,
  State,
  StorageLike,
  User,
  UserInput,
  WarehouseInput,
  WarehouseTask,
} from "./types.ts";
import { assemblyStatus, STATUS_LABELS } from "./helpers.ts";
import { createSeed, STORAGE_KEY } from "./seed.ts";
import { browserStorage, decodeState, loadState } from "./persistence.ts";

const id = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const now = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);
const cents = (value: number) => Math.round(value * 100) / 100;
const fail = (message: string): never => {
  throw new Error(message);
};
const requireCondition: (ok: unknown, message: string) => asserts ok = (
  ok,
  message,
) => {
  if (!ok) fail(message);
};
const text = (value: unknown, label: string, required = true) => {
  requireCondition(typeof value === "string", `${label}: укажите текст.`);
  const result = value.trim();
  requireCondition(!required || result.length > 0, `${label}: заполните поле.`);
  return result;
};
const integer = (value: number, label: string, minimum = 0) => {
  requireCondition(
    Number.isSafeInteger(value) && value >= minimum,
    `${label}: укажите целое число не меньше ${minimum}.`,
  );
  return value;
};
const email = (value: string) => {
  const result = text(value, "Email").toLowerCase();
  requireCondition(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result),
    "Укажите корректный email.",
  );
  return result;
};
const freeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const activeOrder = (order: Order) =>
  !["manager", "shipped", "completed"].includes(order.status);

export function createWholesaleStore(storage?: StorageLike) {
  let state = freeze(loadState(storage));
  const listeners = new Set<() => void>();

  function publish(draft: State) {
    state = freeze(draft);
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* Continue in memory when storage is unavailable. */
    }
    listeners.forEach((listener) => listener());
  }

  function change<T>(operation: (draft: State) => T): T {
    const draft = clone(state);
    const result = operation(draft);
    publish(draft);
    return result;
  }

  function actor(draft: State): User {
    const user = draft.users.find(
      (u) => u.id === draft.sessionUserId && u.active,
    );
    return user ?? fail("Войдите в активную учётную запись.");
  }

  function manager(user: User) {
    requireCondition(
      user.role === "manager" || user.role === "admin",
      "Действие доступно менеджеру или администратору.",
    );
  }

  function permission(user: User, key: keyof User["permissions"]) {
    requireCondition(
      user.role === "admin" ||
        (user.role === "manager" && user.permissions[key]),
      "Недостаточно прав для этого действия.",
    );
  }

  function orderById(draft: State, orderId: string): Order {
    return (
      draft.orders.find((o) => o.id === orderId) ?? fail("Заказ не найден.")
    );
  }

  function taskContext(
    draft: State,
    orderId: string,
    taskId: string,
    own = true,
  ) {
    const user = actor(draft);
    requireCondition(
      user.role === "warehouse_worker",
      "Сборка доступна сотруднику склада.",
    );
    const order = orderById(draft, orderId);
    requireCondition(
      activeOrder(order),
      "Заказ уже передан менеджеру: состав изменить нельзя.",
    );
    const task =
      order.tasks.find((t) => t.id === taskId) ??
      fail("Складское задание не найдено.");
    requireCondition(
      user.warehouseIds.includes(task.warehouseId),
      "Это задание относится к другому складу.",
    );
    if (own)
      requireCondition(
        task.assignedTo === user.id,
        "Сначала примите задание. Чужое задание менять нельзя.",
      );
    return { user, order, task };
  }

  function notify(
    draft: State,
    userIds: string[],
    message: string,
    orderId?: string,
  ) {
    const recipients = new Set(userIds);
    for (const user of draft.users) {
      if (user.active && recipients.has(user.id))
        draft.notifications.unshift({
          id: id("notice"),
          userId: user.id,
          message,
          at: now(),
          read: false,
          ...(orderId ? { orderId } : {}),
        });
    }
    draft.notifications = draft.notifications.slice(0, 1000);
  }

  function managers(draft: State) {
    return draft.users
      .filter((u) => u.role === "manager" || u.role === "admin")
      .map((u) => u.id);
  }

  function event(
    draft: State,
    user: User,
    message: string,
    order?: Order,
    warehouseId?: string,
    recipientIds?: string[],
  ) {
    const at = now();
    draft.events.unshift({
      id: id("event"),
      at,
      actorId: user.id,
      message,
      ...(order ? { orderId: order.id } : {}),
      ...(warehouseId ? { warehouseId } : {}),
    });
    draft.events = draft.events.slice(0, 2000);
    if (order) {
      order.updatedAt = at;
      notify(
        draft,
        recipientIds ?? [order.clientId, ...managers(draft)],
        message,
        order.id,
      );
    } else notify(draft, recipientIds ?? managers(draft), message);
  }

  function deriveStatus(order: Order) {
    order.status = assemblyStatus(order);
  }

  function validatePassword(value: string) {
    requireCondition(
      typeof value === "string" && value.length >= 6,
      "Пароль должен содержать не меньше 6 символов.",
    );
    return value;
  }

  function editableUser(draft: State, input: UserInput, current: User) {
    const existing = input.id
      ? draft.users.find((u) => u.id === input.id)
      : undefined;
    requireCondition(!input.id || existing, "Пользователь не найден.");
    if (current.role !== "admin") {
      requireCondition(
        !existing ||
          (existing.id !== current.id &&
            ["client", "warehouse_worker"].includes(existing.role)),
        "Менеджер может редактировать только клиентов и сотрудников склада.",
      );
      requireCondition(
        ["client", "warehouse_worker"].includes(input.role),
        "Назначать менеджеров и администраторов может только администратор.",
      );
      requireCondition(
        !Object.values(input.permissions ?? {}).some(Boolean),
        "Назначать права управления может только администратор.",
      );
    }
    return existing;
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Browser storage events replace the snapshot without echoing writes. */
    syncStorage(raw: string | null) {
      const incoming = raw === null ? createSeed() : decodeState(raw);
      if (!incoming) return;
      state = freeze(incoming);
      listeners.forEach((listener) => listener());
    },

    login(login: string, password: string): User {
      return change((draft) => {
        let normalized = text(login, "Email").toLowerCase();
        let normalizedPassword = password;
        if (normalized === "demo") normalized = "client@test.com";
        if (normalized === "manager" && password === "manager123") {
          normalized = "manager@test.com";
          normalizedPassword = "demo123";
        }
        const user = draft.users.find(
          (u) =>
            u.email.toLowerCase() === normalized &&
            u.password === normalizedPassword,
        );
        requireCondition(user, "Неверный email или пароль.");
        requireCondition(
          user.active,
          "Учётная запись отключена. Обратитесь к администратору.",
        );
        draft.sessionUserId = user.id;
        return user;
      });
    },

    logout() {
      change((draft) => {
        draft.sessionUserId = null;
      });
    },

    setCartItem(productId: string, quantity: number) {
      change((draft) => {
        const user = actor(draft);
        requireCondition(user.role === "client", "Корзина доступна клиенту.");
        integer(quantity, "Количество");
        const product =
          draft.products.find((p) => p.id === productId) ??
          fail("Товар не найден.");
        if (quantity > 0) {
          requireCondition(
            product.available && product.stock > 0,
            "Товар недоступен для заказа.",
          );
          requireCondition(
            quantity <= product.stock,
            `Доступно только ${product.stock} ${product.unit}`,
          );
        }
        const cart = (draft.carts[user.id] ??= {});
        if (quantity === 0) delete cart[productId];
        else cart[productId] = quantity;
      });
    },

    checkout(input: {
      priority: Priority;
      comment?: string;
      address?: string;
    }): Order {
      return change((draft) => {
        const user = actor(draft);
        requireCondition(
          user.role === "client",
          "Создавать заказ может только клиент.",
        );
        requireCondition(
          ["normal", "urgent", "vip"].includes(input.priority),
          "Выберите корректный приоритет.",
        );
        const cart = draft.carts[user.id] ?? {};
        requireCondition(Object.keys(cart).length > 0, "Корзина пуста.");
        const address = text(input.address ?? user.address, "Адрес доставки");
        const items: OrderItem[] = Object.entries(cart).map(
          ([productId, quantity]) => {
            integer(quantity, "Количество", 1);
            const p =
              draft.products.find((product) => product.id === productId) ??
              fail("Товар больше недоступен.");
            requireCondition(
              p.available && quantity <= p.stock,
              `Недостаточно товара «${p.name}». Доступно: ${p.stock}.`,
            );
            return {
              id: id("item"),
              productId,
              name: p.name,
              image: p.image,
              unit: p.unit,
              warehouseId: p.warehouseId,
              quantity,
              price: p.price,
              picked: 0,
              missing: 0,
            };
          },
        );
        const tasks: WarehouseTask[] = [
          ...new Set(items.map((item) => item.warehouseId)),
        ].map((warehouseId) => ({
          id: id("task"),
          warehouseId,
          status: "new",
        }));
        const order: Order = {
          id: id("order"),
          number: Math.max(1000, ...draft.orders.map((o) => o.number)) + 1,
          clientId: user.id,
          createdAt: now(),
          updatedAt: now(),
          status: "new",
          priority: input.priority,
          items,
          tasks,
          total: cents(
            items.reduce((sum, item) => sum + item.price * item.quantity, 0),
          ),
          address,
          comment: text(input.comment ?? "", "Комментарий", false),
        };
        requireCondition(
          Number.isFinite(order.total) &&
            order.total <= Number.MAX_SAFE_INTEGER / 100,
          "Сумма заказа слишком велика.",
        );
        // Validate the entire cart first, then reserve every item in one state update.
        items.forEach((item) => {
          const product = draft.products.find((p) => p.id === item.productId)!;
          product.stock -= item.quantity;
          if (product.stock === 0) product.available = false;
        });
        draft.orders.unshift(order);
        draft.carts[user.id] = {};
        const workers = draft.users
          .filter(
            (u) =>
              u.role === "warehouse_worker" &&
              u.warehouseIds.some((wh) =>
                tasks.some((task) => task.warehouseId === wh),
              ),
          )
          .map((u) => u.id);
        event(
          draft,
          user,
          `Создан заказ №${order.number}. Задания отправлены на склады.`,
          order,
          undefined,
          [user.id, ...managers(draft), ...workers],
        );
        return order;
      });
    },

    acceptTask(orderId: string, taskId: string) {
      change((draft) => {
        const { user, order, task } = taskContext(
          draft,
          orderId,
          taskId,
          false,
        );
        requireCondition(
          task.status === "new" && !task.assignedTo,
          "Задание уже принято сотрудником.",
        );
        task.assignedTo = user.id;
        task.status = "accepted";
        deriveStatus(order);
        event(
          draft,
          user,
          `${user.name} принял задание по заказу №${order.number}.`,
          order,
          task.warehouseId,
        );
      });
    },

    startTask(orderId: string, taskId: string) {
      change((draft) => {
        const { user, order, task } = taskContext(draft, orderId, taskId);
        requireCondition(
          task.status === "accepted",
          "Начать сборку можно после принятия задания.",
        );
        task.status = "picking";
        task.startedAt = now();
        deriveStatus(order);
        event(
          draft,
          user,
          `Началась сборка заказа №${order.number} на складе.`,
          order,
          task.warehouseId,
        );
      });
    },

    setPicked(orderId: string, itemId: string, picked: number, missing = 0) {
      change((draft) => {
        const order = orderById(draft, orderId);
        const item =
          order.items.find((i) => i.id === itemId) ??
          fail("Позиция заказа не найдена.");
        const task =
          order.tasks.find((t) => t.warehouseId === item.warehouseId) ??
          fail("Задание не найдено.");
        const { user } = taskContext(draft, orderId, task.id);
        requireCondition(
          task.status === "picking",
          "Сначала начните сборку задания.",
        );
        integer(picked, "Собранное количество");
        integer(missing, "Недостача");
        requireCondition(
          picked + missing <= item.quantity,
          "Собранное количество и недостача превышают заказанное количество.",
        );
        item.picked = picked;
        item.missing = missing;
        deriveStatus(order);
        event(
          draft,
          user,
          `Заказ №${order.number}: «${item.name}» собрано ${picked} из ${item.quantity}${missing ? `, недостача ${missing}` : ""}.`,
          order,
          task.warehouseId,
        );
      });
    },

    finishTask(orderId: string, taskId: string) {
      change((draft) => {
        const { user, order, task } = taskContext(draft, orderId, taskId);
        requireCondition(
          task.status === "picking",
          "Завершить можно только задание в сборке.",
        );
        const items = order.items.filter(
          (item) => item.warehouseId === task.warehouseId,
        );
        requireCondition(
          items.every((item) => item.picked + item.missing === item.quantity),
          "Укажите собранное количество или недостачу для каждой позиции.",
        );
        task.status = "done";
        task.completedAt = now();
        deriveStatus(order);
        event(
          draft,
          user,
          `Задание по заказу №${order.number} завершено. Статус заказа: ${STATUS_LABELS[order.status]}.`,
          order,
          task.warehouseId,
        );
      });
    },

    handoff(orderId: string) {
      change((draft) => {
        const user = actor(draft);
        const order = orderById(draft, orderId);
        const assignedWorker =
          user.role === "warehouse_worker" &&
          order.tasks.some(
            (task) =>
              task.assignedTo === user.id &&
              user.warehouseIds.includes(task.warehouseId),
          );
        requireCondition(
          user.role === "manager" || user.role === "admin" || assignedWorker,
          "Передать заказ может менеджер или назначенный сборщик.",
        );
        requireCondition(
          order.status === "ready" &&
            order.tasks.every((task) => task.status === "done") &&
            order.items.every(
              (item) => item.picked + item.missing === item.quantity,
            ),
          "Сначала завершите сборку на всех складах.",
        );
        order.status = "manager";
        event(
          draft,
          user,
          `Заказ №${order.number} передан менеджеру${order.items.some((item) => item.missing > 0) ? " с зафиксированной недостачей" : ""}.`,
          order,
        );
      });
    },

    ship(orderId: string) {
      change((draft) => {
        const user = actor(draft);
        manager(user);
        const order = orderById(draft, orderId);
        requireCondition(
          order.status === "manager",
          "Для отгрузки сначала передайте заказ менеджеру.",
        );
        order.status = "shipped";
        event(draft, user, `Заказ №${order.number} отгружен.`, order);
      });
    },

    complete(orderId: string) {
      change((draft) => {
        const user = actor(draft);
        const order = orderById(draft, orderId);
        requireCondition(
          user.role === "manager" ||
            user.role === "admin" ||
            (user.role === "client" && order.clientId === user.id),
          "Вы не можете завершить этот заказ.",
        );
        requireCondition(
          order.status === "shipped",
          "Завершить можно только отгруженный заказ.",
        );
        order.status = "completed";
        event(draft, user, `Заказ №${order.number} получен и завершён.`, order);
      });
    },

    updateProfile(patch: ProfilePatch) {
      change((draft) => {
        const user = actor(draft);
        const allowed = [
          "name",
          "email",
          "password",
          "storeName",
          "phone",
          "address",
        ];
        requireCondition(
          patch &&
            typeof patch === "object" &&
            Object.keys(patch).every((key) => allowed.includes(key)),
          "Из профиля нельзя изменять роль или права доступа.",
        );
        if (patch.email !== undefined) {
          const next = email(patch.email);
          requireCondition(
            !draft.users.some(
              (u) => u.id !== user.id && u.email.toLowerCase() === next,
            ),
            "Этот email уже используется.",
          );
          user.email = next;
        }
        if (patch.password !== undefined)
          user.password = validatePassword(patch.password);
        if (patch.name !== undefined) user.name = text(patch.name, "Имя");
        if (patch.storeName !== undefined)
          user.storeName = text(patch.storeName, "Название магазина", false);
        if (patch.phone !== undefined)
          user.phone = text(patch.phone, "Телефон", false);
        if (patch.address !== undefined)
          user.address = text(patch.address, "Адрес", false);
        event(
          draft,
          user,
          `${user.name} обновил профиль.`,
          undefined,
          undefined,
          [user.id],
        );
      });
    },

    saveUser(input: UserInput) {
      change((draft) => {
        const current = actor(draft);
        permission(current, "manageUsers");
        const existing = editableUser(draft, input, current);
        requireCondition(
          ["client", "warehouse_worker", "manager", "admin"].includes(
            input.role,
          ),
          "Выберите корректную роль.",
        );
        requireCondition(
          ["new", "regular", "vip"].includes(input.tier),
          "Выберите статус клиента.",
        );
        const nextEmail = email(input.email);
        requireCondition(
          !draft.users.some(
            (u) => u.id !== existing?.id && u.email.toLowerCase() === nextEmail,
          ),
          "Этот email уже используется.",
        );
        requireCondition(
          typeof input.active === "boolean",
          "Укажите активность пользователя.",
        );
        requireCondition(
          Array.isArray(input.warehouseIds) &&
            input.warehouseIds.every((warehouseId) =>
              draft.warehouses.some((wh) => wh.id === warehouseId),
            ),
          "Выберите существующий склад.",
        );
        requireCondition(
          input.role !== "warehouse_worker" || input.warehouseIds.length > 0,
          "Сотруднику склада нужно назначить хотя бы один склад.",
        );
        requireCondition(
          input.permissions &&
            [
              input.permissions.manageUsers,
              input.permissions.manageWarehouses,
              input.permissions.manageProducts,
            ].every((value) => typeof value === "boolean"),
          "Укажите корректные права доступа.",
        );
        if (existing) {
          requireCondition(
            !(
              existing.id === current.id &&
              (!input.active || input.role !== current.role)
            ),
            "Нельзя отключить себя или изменить собственную роль.",
          );
          const assigned = draft.orders
            .filter(activeOrder)
            .flatMap((order) => order.tasks)
            .filter(
              (task) =>
                task.assignedTo === existing.id && task.status !== "done",
            );
          requireCondition(
            assigned.length === 0 ||
              (input.active &&
                input.role === "warehouse_worker" &&
                assigned.every((task) =>
                  input.warehouseIds.includes(task.warehouseId),
                )),
            "У сотрудника есть незавершённые задания. Сначала завершите их.",
          );
          if (
            existing.role === "admin" &&
            (!input.active || input.role !== "admin")
          )
            requireCondition(
              draft.users.some(
                (u) => u.id !== existing.id && u.active && u.role === "admin",
              ),
              "Нельзя отключить последнего администратора.",
            );
        }
        const user: User = {
          id: existing?.id ?? id("user"),
          email: nextEmail,
          password: validatePassword(input.password),
          name: text(input.name, "Имя"),
          role: input.role,
          warehouseIds: [...new Set(input.warehouseIds)],
          active: input.active,
          storeName: text(input.storeName, "Магазин", false),
          phone: text(input.phone, "Телефон", false),
          address: text(input.address, "Адрес", false),
          tier: input.tier,
          permissions: { ...input.permissions },
        };
        if (existing) draft.users[draft.users.indexOf(existing)] = user;
        else draft.users.push(user);
        event(
          draft,
          current,
          `${existing ? "Обновлён" : "Создан"} пользователь ${user.name}.`,
          undefined,
          undefined,
          [user.id, ...managers(draft)],
        );
      });
    },

    saveWarehouse(input: WarehouseInput) {
      change((draft) => {
        const user = actor(draft);
        permission(user, "manageWarehouses");
        const existing = input.id
          ? draft.warehouses.find((wh) => wh.id === input.id)
          : undefined;
        requireCondition(!input.id || existing, "Склад не найден.");
        requireCondition(
          Array.isArray(input.categories) && Array.isArray(input.rows),
          "Укажите категории и ряды склада.",
        );
        const categories = [
          ...new Set(input.categories.map((value) => text(value, "Категория"))),
        ];
        const rows = [
          ...new Set(input.rows.map((value) => text(value, "Ряд"))),
        ];
        requireCondition(
          categories.length > 0 && rows.length > 0,
          "Добавьте хотя бы одну категорию и один ряд.",
        );
        const warehouse = {
          id: existing?.id ?? id("warehouse"),
          name: text(input.name, "Название склада"),
          categories,
          rows,
          color: text(input.color, "Цвет"),
        };
        requireCondition(
          /^#[0-9a-f]{6}$/i.test(warehouse.color),
          "Укажите цвет в формате #RRGGBB.",
        );
        requireCondition(
          !draft.products.some(
            (p) =>
              p.warehouseId === warehouse.id &&
              (!categories.includes(p.category) ||
                !rows.includes(p.location.rack)),
          ),
          "Нельзя убрать категорию или ряд, где размещены товары.",
        );
        if (existing)
          draft.warehouses[draft.warehouses.indexOf(existing)] = warehouse;
        else draft.warehouses.push(warehouse);
        event(
          draft,
          user,
          `${existing ? "Обновлён" : "Создан"} склад «${warehouse.name}».`,
          undefined,
          warehouse.id,
        );
      });
    },

    saveProduct(input: ProductInput) {
      change((draft) => {
        const user = actor(draft);
        permission(user, "manageProducts");
        const existing = input.id
          ? draft.products.find((p) => p.id === input.id)
          : undefined;
        requireCondition(!input.id || existing, "Товар не найден.");
        const warehouse =
          draft.warehouses.find((wh) => wh.id === input.warehouseId) ??
          fail("Выберите существующий склад.");
        requireCondition(
          warehouse.categories.includes(input.category),
          "Категория не относится к выбранному складу.",
        );
        requireCondition(
          input.location && warehouse.rows.includes(input.location.rack),
          "Выберите существующий ряд склада.",
        );
        integer(input.location.shelf, "Полка", 1);
        integer(input.stock, "Остаток");
        requireCondition(
          Number.isFinite(input.price) &&
            cents(input.price) > 0 &&
            input.price <= Number.MAX_SAFE_INTEGER / 100,
          "Цена должна быть не меньше одной копейки.",
        );
        requireCondition(
          typeof input.available === "boolean",
          "Укажите доступность товара.",
        );
        if (existing && existing.warehouseId !== warehouse.id)
          requireCondition(
            !draft.orders.some(
              (o) =>
                activeOrder(o) &&
                o.items.some((item) => item.productId === existing.id),
            ),
            "Товар участвует в незавершённой сборке: сменить склад пока нельзя.",
          );
        const product = {
          id: existing?.id ?? id("product"),
          name: text(input.name, "Название товара"),
          category: input.category,
          warehouseId: warehouse.id,
          price: cents(input.price),
          stock: input.stock,
          unit: text(input.unit, "Единица измерения"),
          image: text(input.image, "Изображение", false),
          location: { ...input.location },
          available: input.available,
        };
        if (existing)
          draft.products[draft.products.indexOf(existing)] = product;
        else draft.products.push(product);
        event(
          draft,
          user,
          `${existing ? "Обновлён" : "Создан"} товар «${product.name}».`,
          undefined,
          warehouse.id,
        );
      });
    },

    readNotice(noticeId: string) {
      change((draft) => {
        const user = actor(draft);
        const notice =
          draft.notifications.find(
            (n) => n.id === noticeId && n.userId === user.id,
          ) ?? fail("Уведомление не найдено.");
        notice.read = true;
      });
    },

    resetDemo() {
      const user = actor(state);
      requireCondition(
        user.role === "admin",
        "Сбросить демонстрацию может только администратор.",
      );
      const seed = createSeed();
      seed.sessionUserId = "u-admin";
      event(
        seed,
        seed.users.find((u) => u.id === "u-admin")!,
        "Демонстрационные данные восстановлены.",
      );
      publish(seed);
    },
  };
}

export type WholesaleStore = ReturnType<typeof createWholesaleStore>;
export const store = createWholesaleStore(browserStorage());

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null)
      store.syncStorage(event.newValue);
  });
}
