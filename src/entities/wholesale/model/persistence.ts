import type { Order, State, StorageLike } from "./types.ts";
import { STATE_VERSION, STORAGE_KEY, createSeed } from "./seed.ts";
import { assemblyStatus } from "./helpers.ts";

type Obj = Record<string, unknown>;
const object = (value: unknown): value is Obj =>
  !!value && typeof value === "object" && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === "string";
const bool = (value: unknown): value is boolean => typeof value === "boolean";
const integer = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) >= 0;
const amount = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const date = (value: unknown) =>
  string(value) && Number.isFinite(Date.parse(value));
const strings = (value: unknown) => Array.isArray(value) && value.every(string);
const oneOf = (value: unknown, values: string[]) =>
  string(value) && values.includes(value);
const rows = (value: unknown, valid: (item: Obj) => boolean): value is Obj[] =>
  Array.isArray(value) &&
  value.every(
    (item) => object(item) && string(item.id) && !!item.id && valid(item),
  ) &&
  new Set(value.map((item) => item.id)).size === value.length;

/** Reject corrupt versions and incomplete snapshots instead of trusting JSON casts. */
export function decodeState(raw: string | null): State | null {
  if (!raw) return null;
  try {
    const s: unknown = JSON.parse(raw);
    if (!object(s) || s.version !== STATE_VERSION) return null;
    if (
      !rows(
        s.users,
        (u) =>
          [u.email, u.password, u.name, u.storeName, u.phone, u.address].every(
            string,
          ) &&
          oneOf(u.role, ["client", "warehouse_worker", "manager", "admin"]) &&
          oneOf(u.tier, ["new", "regular", "vip"]) &&
          strings(u.warehouseIds) &&
          bool(u.active) &&
          object(u.permissions) &&
          [
            u.permissions.manageUsers,
            u.permissions.manageWarehouses,
            u.permissions.manageProducts,
          ].every(bool),
      )
    )
      return null;
    if (
      !rows(
        s.warehouses,
        (w) =>
          string(w.name) &&
          string(w.color) &&
          strings(w.categories) &&
          strings(w.rows) &&
          (w.rows as string[]).length > 0,
      )
    )
      return null;
    if (
      !rows(
        s.products,
        (p) =>
          [p.name, p.category, p.warehouseId, p.unit, p.image].every(string) &&
          amount(p.price) &&
          integer(p.stock) &&
          bool(p.available) &&
          object(p.location) &&
          string(p.location.rack) &&
          integer(p.location.shelf) &&
          Number(p.location.shelf) > 0,
      )
    )
      return null;
    if (
      !rows(
        s.orders,
        (o) =>
          integer(o.number) &&
          [o.clientId, o.address, o.comment].every(string) &&
          date(o.createdAt) &&
          date(o.updatedAt) &&
          oneOf(o.status, [
            "new",
            "accepted",
            "picking",
            "partial",
            "ready",
            "manager",
            "shipped",
            "completed",
          ]) &&
          oneOf(o.priority, ["normal", "urgent", "vip"]) &&
          amount(o.total) &&
          rows(
            o.items,
            (i) =>
              [i.productId, i.name, i.image, i.unit, i.warehouseId].every(
                string,
              ) &&
              amount(i.price) &&
              integer(i.quantity) &&
              Number(i.quantity) > 0 &&
              integer(i.picked) &&
              integer(i.missing) &&
              Number(i.picked) + Number(i.missing) <= Number(i.quantity),
          ) &&
          o.items.length > 0 &&
          rows(
            o.tasks,
            (t) =>
              string(t.warehouseId) &&
              oneOf(t.status, ["new", "accepted", "picking", "done"]) &&
              (t.assignedTo === undefined || string(t.assignedTo)) &&
              (t.startedAt === undefined || date(t.startedAt)) &&
              (t.completedAt === undefined || date(t.completedAt)),
          ) &&
          o.tasks.length > 0,
      )
    )
      return null;
    if (
      !rows(
        s.events,
        (e) =>
          date(e.at) &&
          string(e.actorId) &&
          string(e.message) &&
          (e.orderId === undefined || string(e.orderId)) &&
          (e.warehouseId === undefined || string(e.warehouseId)),
      )
    )
      return null;
    if (
      !rows(
        s.notifications,
        (n) =>
          date(n.at) &&
          string(n.userId) &&
          string(n.message) &&
          bool(n.read) &&
          (n.orderId === undefined || string(n.orderId)),
      )
    )
      return null;
    if (
      !object(s.carts) ||
      !(s.sessionUserId === null || string(s.sessionUserId))
    )
      return null;

    // Preserve version-1 workspaces: the retired status only changes its label
    // and transition meaning. All orders, users, carts and shortage counts stay.
    for (const order of s.orders) {
      if (order.status === "partial") {
        order.status = assemblyStatus(order as unknown as Order);
      }
    }
    const state = s as unknown as State;
    const users = new Map(state.users.map((u) => [u.id, u]));
    const warehouses = new Map(state.warehouses.map((w) => [w.id, w]));
    const products = new Set(state.products.map((p) => p.id));
    if (!state.users.some((u) => u.role === "admin" && u.active)) return null;
    if (
      new Set(state.users.map((u) => u.email.toLowerCase())).size !==
      state.users.length
    )
      return null;
    if (
      state.users.some((u) => u.warehouseIds.some((id) => !warehouses.has(id)))
    )
      return null;
    if (
      state.products.some((p) => {
        const warehouse = warehouses.get(p.warehouseId);
        return (
          !warehouse ||
          !warehouse.categories.includes(p.category) ||
          !warehouse.rows.includes(p.location.rack)
        );
      })
    )
      return null;
    if (
      state.orders.some((o) => {
        const taskWarehouses = new Set(o.tasks.map((t) => t.warehouseId));
        const itemWarehouses = new Set(o.items.map((i) => i.warehouseId));
        const allDone = o.tasks.every((t) => t.status === "done");
        const derivedStatus = assemblyStatus(o);
        const handedOff = ["manager", "shipped", "completed"].includes(o.status);
        return (
          !users.has(o.clientId) ||
          taskWarehouses.size !== o.tasks.length ||
          taskWarehouses.size !== itemWarehouses.size ||
          (handedOff ? !allDone : o.status !== derivedStatus) ||
          o.items.some(
            (i) =>
              !products.has(i.productId) || !taskWarehouses.has(i.warehouseId),
          ) ||
          o.tasks.some((t) => {
            const worker = t.assignedTo ? users.get(t.assignedTo) : undefined;
            const items = o.items.filter((i) => i.warehouseId === t.warehouseId);
            if (!warehouses.has(t.warehouseId) || !itemWarehouses.has(t.warehouseId)) return true;
            if (t.status === "new") return !!(t.assignedTo || t.startedAt || t.completedAt)
              || items.some((i) => i.picked !== 0 || i.missing !== 0);
            if (!worker) return true;
            // Completed tasks retain their historical assignee after role or
            // warehouse changes; only unfinished tasks require a current worker.
            if (t.status === "done") return !t.startedAt || !t.completedAt
              || items.some((i) => i.picked + i.missing !== i.quantity);
            if (!worker.active || worker.role !== "warehouse_worker"
              || !worker.warehouseIds.includes(t.warehouseId) || t.completedAt) return true;
            return t.status === "accepted"
              ? !!t.startedAt || items.some((i) => i.picked !== 0 || i.missing !== 0)
              : !t.startedAt;
          }) ||
          Math.abs(
            o.total - o.items.reduce((sum, i) => sum + i.price * i.quantity, 0),
          ) > 0.011
        );
      })
    )
      return null;
    if (
      Object.entries(state.carts).some(
        ([id, cart]) =>
          !users.has(id) ||
          !object(cart) ||
          Object.entries(cart).some(
            ([productId, quantity]) =>
              !products.has(productId) || !integer(quantity) || quantity < 1,
          ),
      )
    )
      return null;
    if (state.sessionUserId && !users.get(state.sessionUserId)?.active)
      state.sessionUserId = null;
    return state;
  } catch {
    return null;
  }
}

export function loadState(storage?: StorageLike): State {
  try {
    return decodeState(storage?.getItem(STORAGE_KEY) ?? null) ?? createSeed();
  } catch {
    return createSeed();
  }
}

export function browserStorage(): StorageLike | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
