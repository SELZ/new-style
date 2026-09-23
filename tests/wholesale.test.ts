import assert from "node:assert/strict";
import test from "node:test";
import {
  createWholesaleStore,
  orderProgress,
  STATUS_LABELS,
  STORAGE_KEY,
  visibleOrders,
  visibleTasks,
} from "../src/entities/wholesale/index.ts";
import type {
  Order,
  ProductInput,
  ProfilePatch,
  State,
  StorageLike,
  UserInput,
  WholesaleStore,
} from "../src/entities/wholesale/index.ts";

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  writes = 0;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes += 1; this.values.set(key, value); }
}

function login(store: WholesaleStore, account: string) {
  return store.login(`${account}@test.com`, "demo123");
}

function currentOrder(store: WholesaleStore, id: string): Order {
  const order = store.getState().orders.find((item) => item.id === id);
  assert.ok(order, `Order ${id} should exist`);
  return order;
}

function threeWarehouseOrder(store: WholesaleStore) {
  login(store, "client");
  store.setCartItem("p-juice", 2);
  store.setCartItem("p-chips", 3);
  store.setCartItem("p-detergent", 1);
  return store.checkout({ priority: "urgent", comment: "Доставка утром", address: "Москва, Складская, 7" });
}

function userInput(overrides: Partial<UserInput> = {}): UserInput {
  return {
    name: "Новый сотрудник", email: "new-worker@test.com", password: "demo123",
    role: "warehouse_worker", warehouseIds: ["wh-drinks"], active: true,
    storeName: "", phone: "", address: "", tier: "new",
    permissions: { manageUsers: false, manageWarehouses: false, manageProducts: false },
    ...overrides,
  };
}

function rejectsWithoutChanges(store: WholesaleStore, operation: () => unknown, message: RegExp) {
  const snapshot = store.getState();
  assert.throws(operation, message);
  assert.equal(store.getState(), snapshot, "Rejected operation must not publish a partial update");
}

test("checkout creates one order with three warehouse tasks and reserves stock atomically", () => {
  const storage = new MemoryStorage();
  const store = createWholesaleStore(storage);
  const stockBefore = new Map(store.getState().products.map((product) => [product.id, product.stock]));
  const orderCount = store.getState().orders.length;
  const order = threeWarehouseOrder(store);

  assert.equal(store.getState().orders.length, orderCount + 1);
  assert.equal(order.status, "new");
  assert.equal(order.priority, "urgent");
  assert.equal(order.address, "Москва, Складская, 7");
  assert.equal(order.comment, "Доставка утром");
  assert.deepEqual(new Set(order.tasks.map((task) => task.warehouseId)), new Set(["wh-drinks", "wh-snacks", "wh-chemicals"]));
  assert.equal(order.tasks.length, 3);
  assert.ok(order.tasks.every((task) => task.status === "new" && !task.assignedTo));
  assert.equal(order.total, order.items.reduce((sum, item) => sum + item.price * item.quantity, 0));
  for (const item of order.items) {
    assert.equal(store.getState().products.find((product) => product.id === item.productId)?.stock,
      stockBefore.get(item.productId)! - item.quantity);
  }
  assert.deepEqual(store.getState().carts[order.clientId], {});
  const recipients = new Set(store.getState().notifications.filter((notice) => notice.orderId === order.id).map((notice) => notice.userId));
  for (const id of ["u-client", "u-worker-drinks", "u-worker-snacks", "u-worker-chemicals", "u-manager", "u-admin"]) assert.ok(recipients.has(id));
  assert.ok(store.getState().events.some((event) => event.orderId === order.id && event.actorId === "u-client"));
  assert.ok(storage.getItem(STORAGE_KEY));
  rejectsWithoutChanges(store, () => store.checkout({ priority: "normal" }), /Корзина пуста/);
});

test("changing roles preserves separate client carts and restricts order/task visibility", () => {
  const store = createWholesaleStore();
  const order = threeWarehouseOrder(store);
  store.setCartItem("p-water", 4);
  const other = login(store, "market");
  assert.ok(!visibleOrders(store.getState(), other).some((item) => item.id === order.id));
  assert.deepEqual(store.getState().carts[other.id] ?? {}, {});
  store.setCartItem("p-chips", 1);
  const worker = login(store, "worker1");
  const tasks = visibleTasks(store.getState(), worker);
  assert.ok(tasks.some(({ order: visible }) => visible.id === order.id));
  assert.ok(tasks.every(({ task }) => worker.warehouseIds.includes(task.warehouseId)));
  rejectsWithoutChanges(store, () => store.setCartItem("p-water", 1), /клиенту/);
  login(store, "client");
  assert.deepEqual(store.getState().carts["u-client"], { "p-water": 4 });
  assert.deepEqual(store.getState().carts[other.id], { "p-chips": 1 });
  store.logout();
  rejectsWithoutChanges(store, () => store.checkout({ priority: "normal" }), /Войдите/);
});

test("warehouse tasks enforce assignment, warehouse membership and picking order", () => {
  const store = createWholesaleStore();
  const order = threeWarehouseOrder(store);
  const own = order.tasks.find((task) => task.warehouseId === "wh-drinks")!;
  const foreign = order.tasks.find((task) => task.warehouseId === "wh-snacks")!;
  const item = order.items.find((entry) => entry.warehouseId === own.warehouseId)!;
  login(store, "manager");
  rejectsWithoutChanges(store, () => store.acceptTask(order.id, own.id), /сотруднику склада/);
  login(store, "worker1");
  rejectsWithoutChanges(store, () => store.acceptTask(order.id, foreign.id), /другому складу/);
  rejectsWithoutChanges(store, () => store.startTask(order.id, own.id), /примите задание/);
  store.acceptTask(order.id, own.id);
  assert.equal(currentOrder(store, order.id).status, "accepted");
  rejectsWithoutChanges(store, () => store.setPicked(order.id, item.id, 1), /начните сборку/);
  store.startTask(order.id, own.id);
  assert.equal(currentOrder(store, order.id).status, "picking");
  rejectsWithoutChanges(store, () => store.finishTask(order.id, own.id), /каждой позиции/);
  rejectsWithoutChanges(store, () => store.setPicked(order.id, item.id, item.quantity + 1), /превышают/);
  rejectsWithoutChanges(store, () => store.setPicked(order.id, item.id, 0.5), /целое число/);
  rejectsWithoutChanges(store, () => store.setPicked(order.id, item.id, 0, -1), /целое число/);

  login(store, "admin");
  store.saveUser(userInput());
  login(store, "new-worker");
  rejectsWithoutChanges(store, () => store.acceptTask(order.id, own.id), /уже принято/);
  rejectsWithoutChanges(store, () => store.setPicked(order.id, item.id, 1), /Чужое задание/);
});

test("completed assembly retains shortages through handoff, shipment and client completion", () => {
  const store = createWholesaleStore();
  const original = threeWarehouseOrder(store);
  const accounts: Record<string, string> = { "wh-drinks": "worker1", "wh-snacks": "worker2", "wh-chemicals": "worker3" };

  for (const task of original.tasks) {
    login(store, accounts[task.warehouseId]);
    store.acceptTask(original.id, task.id);
    store.startTask(original.id, task.id);
    for (const item of original.items.filter((entry) => entry.warehouseId === task.warehouseId)) {
      const missing = task.warehouseId === "wh-drinks" ? 1 : 0;
      store.setPicked(original.id, item.id, item.quantity - missing, missing);
    }
    store.finishTask(original.id, task.id);
    if (currentOrder(store, original.id).tasks.some((entry) => entry.status !== "done")) {
      assert.equal(currentOrder(store, original.id).status, "picking");
      rejectsWithoutChanges(store, () => store.handoff(original.id), /всех складах/);
    }
  }

  const assembled = currentOrder(store, original.id);
  assert.equal(assembled.status, "ready");
  assert.equal(STATUS_LABELS[assembled.status], "Сборка завершена");
  assert.ok(assembled.tasks.every((task) => task.status === "done" && task.completedAt));
  assert.equal(assembled.items.reduce((sum, item) => sum + item.missing, 0), 1);
  assert.ok(orderProgress(assembled) < 100, "Missing units must not count as picked");
  rejectsWithoutChanges(store, () => store.ship(original.id), /менеджеру/);
  store.handoff(original.id);
  assert.equal(currentOrder(store, original.id).status, "manager");
  const lastItem = original.items.find((item) => item.warehouseId === "wh-chemicals")!;
  rejectsWithoutChanges(store, () => store.setPicked(original.id, lastItem.id, lastItem.quantity), /уже передан/);
  login(store, "manager");
  rejectsWithoutChanges(store, () => store.complete(original.id), /отгруженный/);
  store.ship(original.id);
  assert.equal(currentOrder(store, original.id).status, "shipped");
  login(store, "market");
  rejectsWithoutChanges(store, () => store.complete(original.id), /не можете/);
  login(store, "client");
  store.complete(original.id);
  assert.equal(currentOrder(store, original.id).status, "completed");
  assert.equal(currentOrder(store, original.id).items.reduce((sum, item) => sum + item.missing, 0), 1);
  rejectsWithoutChanges(store, () => store.complete(original.id), /отгруженный/);
});

test("fully picked order becomes ready only after its task is finished", () => {
  const store = createWholesaleStore();
  login(store, "client");
  store.setCartItem("p-water", 2);
  const order = store.checkout({ priority: "normal" });
  login(store, "worker1");
  store.acceptTask(order.id, order.tasks[0].id);
  store.startTask(order.id, order.tasks[0].id);
  store.setPicked(order.id, order.items[0].id, 2);
  assert.equal(currentOrder(store, order.id).status, "picking");
  store.finishTask(order.id, order.tasks[0].id);
  assert.equal(currentOrder(store, order.id).status, "ready");
  assert.equal(orderProgress(currentOrder(store, order.id)), 100);
  login(store, "manager");
  rejectsWithoutChanges(store, () => store.ship(order.id), /передайте/);
  store.handoff(order.id);
  store.ship(order.id);
  store.complete(order.id);
  assert.equal(currentOrder(store, order.id).status, "completed");
});

test("one completed warehouse leaves a multi-warehouse order picking until every warehouse finishes", () => {
  const store = createWholesaleStore();
  const order = threeWarehouseOrder(store);
  const accounts: Record<string, string> = { "wh-drinks": "worker1", "wh-snacks": "worker2", "wh-chemicals": "worker3" };
  order.tasks.forEach((task, index) => {
    login(store, accounts[task.warehouseId]);
    store.acceptTask(order.id, task.id);
    if (index > 0) assert.equal(currentOrder(store, order.id).status, "picking");
    store.startTask(order.id, task.id);
    for (const item of order.items.filter((entry) => entry.warehouseId === task.warehouseId)) {
      store.setPicked(order.id, item.id, item.quantity);
    }
    store.finishTask(order.id, task.id);
    assert.equal(currentOrder(store, order.id).status, index === order.tasks.length - 1 ? "ready" : "picking");
  });
  assert.equal(orderProgress(currentOrder(store, order.id)), 100);
});

test("stock changed after adding to cart rejects checkout without partial reservations", () => {
  const store = createWholesaleStore();
  login(store, "client");
  store.setCartItem("p-water", 2);
  store.setCartItem("p-chips", 3);
  rejectsWithoutChanges(store, () => store.setCartItem("p-water", Number.NaN), /целое/);
  rejectsWithoutChanges(store, () => store.setCartItem("p-water", 1_000_000), /Доступно/);
  login(store, "admin");
  const product = store.getState().products.find((item) => item.id === "p-chips")!;
  store.saveProduct({ ...product, stock: 1 });
  login(store, "client");
  const before = store.getState();
  rejectsWithoutChanges(store, () => store.checkout({ priority: "normal" }), /Недостаточно товара/);
  assert.equal(store.getState().products.find((item) => item.id === "p-water")?.stock,
    before.products.find((item) => item.id === "p-water")?.stock);
  assert.deepEqual(store.getState().carts["u-client"], { "p-water": 2, "p-chips": 3 });
});

test("administration permissions prevent escalation and allow delegated user management", () => {
  const store = createWholesaleStore();
  login(store, "client");
  rejectsWithoutChanges(store, () => store.saveUser(userInput()), /Недостаточно прав/);
  rejectsWithoutChanges(store, () => store.updateProfile({ role: "admin" } as unknown as ProfilePatch), /роль или права/);
  login(store, "admin");
  const manager = store.getState().users.find((user) => user.role === "manager")!;
  store.saveUser({ ...manager, permissions: { manageUsers: false, manageWarehouses: false, manageProducts: false } });
  login(store, "manager");
  rejectsWithoutChanges(store, () => store.saveUser(userInput()), /Недостаточно прав/);
  rejectsWithoutChanges(store, () => store.saveWarehouse({ ...store.getState().warehouses[0] }), /Недостаточно прав/);
  rejectsWithoutChanges(store, () => store.saveProduct({ ...store.getState().products[0] }), /Недостаточно прав/);
  login(store, "admin");
  store.saveUser({ ...manager, permissions: { manageUsers: true, manageWarehouses: false, manageProducts: false } });
  login(store, "manager");
  store.saveUser(userInput());
  assert.ok(store.getState().users.some((user) => user.email === "new-worker@test.com"));
  rejectsWithoutChanges(store, () => store.saveUser(userInput({ email: "elevated@test.com", role: "admin" })), /только администратор/);
  rejectsWithoutChanges(store, () => store.saveUser(userInput({ email: "rights@test.com", permissions: { manageUsers: true, manageWarehouses: false, manageProducts: false } })), /только администратор/);
  const admin = store.getState().users.find((user) => user.role === "admin")!;
  rejectsWithoutChanges(store, () => store.saveUser({ ...admin, name: "Changed" }), /только клиентов/);
});

test("users cannot be duplicated, self-disabled or removed from active assignments", () => {
  const store = createWholesaleStore();
  const order = threeWarehouseOrder(store);
  login(store, "worker1");
  const task = order.tasks.find((entry) => entry.warehouseId === "wh-drinks")!;
  store.acceptTask(order.id, task.id);
  const worker = store.getState().users.find((user) => user.id === "u-worker-drinks")!;
  const admin = login(store, "admin");
  rejectsWithoutChanges(store, () => store.saveUser(userInput({ email: " CLIENT@TEST.COM " })), /уже используется/);
  rejectsWithoutChanges(store, () => store.saveUser(userInput({ password: "short" })), /6 символов/);
  rejectsWithoutChanges(store, () => store.saveUser(userInput({ warehouseIds: [] })), /хотя бы один склад/);
  rejectsWithoutChanges(store, () => store.saveUser({ ...admin, active: false }), /отключить себя/);
  rejectsWithoutChanges(store, () => store.saveUser({ ...worker, active: false }), /незавершённые задания/);
  store.saveUser(userInput({ email: "inactive@test.com", active: false }));
  rejectsWithoutChanges(store, () => login(store, "inactive"), /отключена/);
  rejectsWithoutChanges(store, () => store.login("client@test.com", "wrong"), /Неверный/);
});

test("warehouse and product edits keep catalog references valid", () => {
  const store = createWholesaleStore();
  login(store, "admin");
  store.saveWarehouse({ name: "Кофейный склад", categories: ["Кофе"], rows: ["K"], color: "#137c66" });
  const warehouse = store.getState().warehouses.find((item) => item.name === "Кофейный склад")!;
  const input: ProductInput = { name: "Кофе в зернах", category: "Кофе", warehouseId: warehouse.id,
    price: 899.99, stock: 12, unit: "уп.", image: "", location: { rack: "K", shelf: 1 }, available: true };
  store.saveProduct(input);
  const product = store.getState().products.find((item) => item.name === input.name)!;
  assert.equal(product.price, 899.99);
  store.saveProduct({ ...product, price: 949.5, stock: 8 });
  assert.equal(store.getState().products.find((item) => item.id === product.id)?.stock, 8);
  rejectsWithoutChanges(store, () => store.saveWarehouse({ ...warehouse, rows: ["L"] }), /размещены товары/);
  rejectsWithoutChanges(store, () => store.saveWarehouse({ ...warehouse, categories: ["Чай"] }), /размещены товары/);
  rejectsWithoutChanges(store, () => store.saveProduct({ ...product, price: -1 }), /Цена/);
  rejectsWithoutChanges(store, () => store.saveProduct({ ...product, price: 0.001 }), /Цена/);
  rejectsWithoutChanges(store, () => store.saveProduct({ ...product, stock: 1.5 }), /целое число/);
  rejectsWithoutChanges(store, () => store.saveProduct({ ...product, category: "Напитки" }), /не относится/);
  rejectsWithoutChanges(store, () => store.saveProduct({ ...product, location: { rack: "Z", shelf: 1 } }), /существующий ряд/);
  rejectsWithoutChanges(store, () => store.saveProduct({ ...product, location: { rack: "K", shelf: 0 } }), /не меньше 1/);
  rejectsWithoutChanges(store, () => store.saveProduct({ ...product, id: "missing" }), /Товар не найден/);
});

test("persistent snapshots restore orders, cart and session; sync does not echo writes", () => {
  const storage = new MemoryStorage();
  const first = createWholesaleStore(storage);
  const order = threeWarehouseOrder(first);
  first.setCartItem("p-water", 2);
  const restored = createWholesaleStore(storage);
  assert.deepEqual(restored.getState(), first.getState());
  assert.equal(currentOrder(restored, order.id).tasks.length, 3);
  assert.equal(restored.getState().sessionUserId, "u-client");
  first.updateProfile({ storeName: "Обновленный магазин" });
  let notifications = 0;
  const unsubscribe = restored.subscribe(() => { notifications += 1; });
  const writes = storage.writes;
  restored.syncStorage(storage.getItem(STORAGE_KEY));
  assert.deepEqual(restored.getState(), first.getState());
  assert.equal(notifications, 1);
  assert.equal(storage.writes, writes);
  const snapshot = restored.getState();
  restored.syncStorage('{"version":1,"users":[]}');
  assert.equal(restored.getState(), snapshot);
  unsubscribe();
  restored.syncStorage(storage.getItem(STORAGE_KEY));
  assert.equal(notifications, 1);
});

test("legacy partial snapshots migrate in place without losing orders, carts, users or shortages", () => {
  const storage = new MemoryStorage();
  const original = createWholesaleStore(storage);
  const order = threeWarehouseOrder(original);
  original.updateProfile({ storeName: "Магазин, сохранённый до миграции" });
  original.setCartItem("p-water", 4);
  login(original, "admin");
  original.saveUser(userInput({ email: "preserved-worker@test.com" }));
  login(original, "worker1");
  const task = order.tasks.find((item) => item.warehouseId === "wh-drinks")!;
  const item = order.items.find((entry) => entry.warehouseId === task.warehouseId)!;
  original.acceptTask(order.id, task.id);
  original.startTask(order.id, task.id);
  original.setPicked(order.id, item.id, item.quantity - 1, 1);
  original.finishTask(order.id, task.id);
  assert.equal(currentOrder(original, order.id).status, "picking");

  type LegacyState = Omit<State, "orders"> & {
    orders: (Omit<Order, "status"> & { status: Order["status"] | "partial" })[];
  };
  const legacy: LegacyState = structuredClone(original.getState());
  legacy.orders.find((entry) => entry.id === order.id)!.status = "partial";
  const completedWithShortage = legacy.orders.find((entry) => entry.id === "order-1045")!;
  assert.ok(completedWithShortage.tasks.every((entry) => entry.status === "done"));
  assert.ok(completedWithShortage.items.some((entry) => entry.missing > 0));
  completedWithShortage.status = "partial";
  storage.setItem(STORAGE_KEY, JSON.stringify(legacy));

  const restored = createWholesaleStore(storage);
  assert.deepEqual(restored.getState(), original.getState(), "Migration may only change the retired status");
  assert.equal(currentOrder(restored, order.id).status, "picking");
  assert.equal(currentOrder(restored, "order-1045").status, "ready");
  assert.equal(currentOrder(restored, order.id).items.find((entry) => entry.id === item.id)?.missing, 1);
  assert.deepEqual(restored.getState().carts["u-client"], { "p-water": 4 });

  // Cross-tab synchronization goes through the same migration, without writes.
  const other = createWholesaleStore();
  other.syncStorage(JSON.stringify(legacy));
  assert.deepEqual(other.getState(), original.getState());
  restored.logout();
  const persisted = JSON.parse(storage.getItem(STORAGE_KEY)!);
  assert.ok(persisted.orders.every((entry: { status: string }) => entry.status !== "partial"));
});

test("corrupt or unavailable storage recovers a usable store and snapshots cannot be mutated", () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, "{broken json");
  const recovered = createWholesaleStore(storage);
  assert.ok(recovered.getState().users.some((user) => user.role === "admin" && user.active));
  login(recovered, "client");
  const snapshot = recovered.getState();
  assert.throws(() => { snapshot.users[0].name = "Mutated"; }, TypeError);
  assert.throws(() => { snapshot.warehouses[0].rows.push("Z"); }, TypeError);
  const unavailable = createWholesaleStore({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); } });
  login(unavailable, "client");
  unavailable.setCartItem("p-water", 1);
  assert.equal(unavailable.getState().carts["u-client"]["p-water"], 1);
});

test("notifications can only be acknowledged by their own recipient", () => {
  const store = createWholesaleStore();
  const order = threeWarehouseOrder(store);
  const own = store.getState().notifications.find((notice) => notice.orderId === order.id && notice.userId === "u-client")!;
  const foreign = store.getState().notifications.find((notice) => notice.orderId === order.id && notice.userId === "u-manager")!;
  rejectsWithoutChanges(store, () => store.readNotice(foreign.id), /не найдено/);
  store.readNotice(own.id);
  assert.equal(store.getState().notifications.find((notice) => notice.id === own.id)?.read, true);
  assert.equal(store.getState().notifications.find((notice) => notice.id === foreign.id)?.read, false);
});

test("completed task history survives a later employee role change and reload", () => {
  const storage = new MemoryStorage();
  const store = createWholesaleStore(storage);
  login(store, "admin");
  store.saveUser(userInput());
  login(store, "client");
  store.setCartItem("p-water", 1);
  const order = store.checkout({ priority: "normal" });
  const worker = login(store, "new-worker");
  store.acceptTask(order.id, order.tasks[0].id);
  store.startTask(order.id, order.tasks[0].id);
  store.setPicked(order.id, order.items[0].id, 1);
  store.finishTask(order.id, order.tasks[0].id);
  login(store, "admin");
  store.saveUser({ ...worker, role: "client", warehouseIds: [], storeName: "Новый магазин" });
  const restored = createWholesaleStore(storage);
  assert.deepEqual(restored.getState(), store.getState());
  assert.equal(currentOrder(restored, order.id).tasks[0].assignedTo, worker.id);
  assert.equal(currentOrder(restored, order.id).tasks[0].status, "done");
  assert.equal(restored.getState().users.find((user) => user.id === worker.id)?.role, "client");
});
