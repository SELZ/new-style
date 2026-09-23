import { Button, Paper, Select, TextInput } from "@mantine/core";
import { Plus, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  useWholesale,
  visibleOrders,
} from "../../../entities/wholesale/index.ts";
import { OrderTable } from "./OrderTable.tsx";

export function OrdersPage() {
  const { state, user } = useWholesale();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "all";
  const priority = params.get("priority") ?? "all";
  function setFilter(key: string, value: string | null) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value && value !== "all") next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }
  if (!user) return null;
  const q = params.get("q") ?? "";
  const all = visibleOrders(state, user);
  const orders = all
    .filter((o) => {
      const client = state.users.find((u) => u.id === o.clientId);
      return (
        `${o.number} ${client?.storeName} ${client?.name}`
          .toLowerCase()
          .includes(q.toLowerCase()) &&
        (status === "all" ||
          (status === "active"
            ? o.status !== "completed"
            : o.status === status)) &&
        (priority === "all" || o.priority === priority)
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ЕДИНЫЙ ПОТОК</span>
          <h1>
            {user.role === "client" ? "Мои заказы" : "Заказы"}
            <span className="heading-dot">.</span>
          </h1>
          <p>Следите за каждым этапом и открывайте детали сборки.</p>
        </div>
        {user.role === "client" && (
          <Button
            component={Link}
            to="/catalog"
            leftSection={<Plus size={17} />}
          >
            Новый заказ
          </Button>
        )}
      </div>
      <Paper className="panel">
        <div className="filter-toolbar">
          <TextInput
            aria-label="Поиск заказов"
            placeholder="Номер заказа или клиент"
            leftSection={<Search size={17} />}
            value={q}
            onChange={(e) => setFilter("q", e.currentTarget.value)}
          />
          <Select
            aria-label="Статус заказа"
            value={status}
            onChange={(value) => setFilter("status", value)}
            data={[
              { value: "all", label: "Все статусы" },
              { value: "active", label: "Текущие заказы" },
              ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
            allowDeselect={false}
          />
          <Select
            aria-label="Приоритет заказа"
            value={priority}
            onChange={(value) => setFilter("priority", value)}
            data={[
              { value: "all", label: "Любой приоритет" },
              ...Object.entries(PRIORITY_LABELS).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
            allowDeselect={false}
          />
        </div>
        <div className="table-caption">Найдено заказов: {orders.length}</div>
        <OrderTable orders={orders} state={state} user={user} />
      </Paper>
    </>
  );
}
