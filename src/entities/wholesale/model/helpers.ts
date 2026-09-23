import type {
  Order,
  OrderStatus,
  Priority,
  Role,
  State,
  Tier,
  User,
} from "./types.ts";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новый",
  accepted: "Принят",
  picking: "В сборке",
  ready: "Сборка завершена",
  manager: "Передан менеджеру",
  shipped: "Отправлен клиенту",
  completed: "Завершён",
};
export const ROLE_LABELS: Record<Role, string> = {
  client: "Клиент",
  warehouse_worker: "Сборщик",
  manager: "Менеджер",
  admin: "Администратор",
};
export const PRIORITY_LABELS: Record<Priority, string> = {
  normal: "Обычный",
  urgent: "Срочный",
  vip: "VIP",
};
export const TIER_LABELS: Record<Tier, string> = {
  new: "Новый",
  regular: "Постоянный",
  vip: "VIP",
};

/** Common rule for live transitions and persisted orders before manager handoff. */
export function assemblyStatus(order: Order): OrderStatus {
  if (order.tasks.every((task) => task.status === "done")
    && order.items.every((item) => item.picked + item.missing === item.quantity)) return "ready";
  if (order.tasks.some((task) => task.status === "picking" || task.status === "done")) return "picking";
  if (order.tasks.some((task) => task.status === "accepted")) return "accepted";
  return "new";
}

export const money = (value: number): string =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(value);

export const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export function visibleOrders(state: State, user: User): Order[] {
  if (user.role === "client")
    return state.orders.filter((order) => order.clientId === user.id);
  if (user.role === "warehouse_worker") {
    return state.orders.filter((order) =>
      order.tasks.some((task) => user.warehouseIds.includes(task.warehouseId)),
    );
  }
  return state.orders;
}

export function visibleTasks(state: State, user: User) {
  return visibleOrders(state, user).flatMap((order) =>
    order.tasks
      .filter(
        (task) =>
          user.role !== "warehouse_worker" ||
          user.warehouseIds.includes(task.warehouseId),
      )
      .map((task) => ({ order, task })),
  );
}

/** Physical picking progress (missing items remain visibly unpicked). */
export function orderProgress(order: Order): number {
  const total = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return total
    ? Math.round(
        (order.items.reduce((sum, item) => sum + item.picked, 0) / total) * 100,
      )
    : 0;
}
