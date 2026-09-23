import { useState } from "react";
import { Alert, Badge, Button, Paper, SegmentedControl } from "@mantine/core";
import { ArrowRight, CheckCheck, Clock3, Play, Warehouse } from "lucide-react";
import { Link } from "react-router-dom";
import {
  formatDate,
  PRIORITY_LABELS,
  store,
  useWholesale,
  visibleTasks,
} from "../../../entities/wholesale/index.ts";
import { StatusBadge } from "../../../shared/ui/status-badge/index.ts";

export function TasksPage() {
  const { state, user } = useWholesale();
  const [filter, setFilter] = useState("active");
  const [error, setError] = useState("");
  if (!user) return null;
  const all = visibleTasks(state, user);
  const tasks = all
    .filter(({ task }) =>
      filter === "done" ? task.status === "done" : task.status !== "done",
    )
    .sort(
      (a, b) =>
        Number(b.order.priority !== "normal") -
          Number(a.order.priority !== "normal") ||
        a.order.createdAt.localeCompare(b.order.createdAt),
    );
  function act(fn: () => void) {
    try {
      fn();
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось выполнить действие",
      );
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">РАБОЧЕЕ МЕСТО СБОРЩИКА</span>
          <h1>
            Сборка заказов<span className="heading-dot">.</span>
          </h1>
          <p>
            {state.warehouses
              .filter((w) => user.warehouseIds.includes(w.id))
              .map((w) => w.name)
              .join(" · ") || "Склады не назначены"}
          </p>
        </div>
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          data={[
            {
              value: "active",
              label: `В работе · ${all.filter((t) => t.task.status !== "done").length}`,
            },
            { value: "done", label: "Завершённые" },
          ]}
        />
      </div>
      {error && (
        <Alert color="red" role="alert" mb="md">
          {error}
        </Alert>
      )}
      <div className="task-grid">
        {tasks.map(({ order, task }) => {
          const client = state.users.find((u) => u.id === order.clientId);
          const lines = order.items.filter(
            (i) => i.warehouseId === task.warehouseId,
          );
          const qty = lines.reduce((s, i) => s + i.quantity, 0);
          const picked = lines.reduce((s, i) => s + i.picked, 0);
          return (
            <Paper className="panel task-card" key={task.id}>
              <div className="task-card-top">
                <Link to={`/orders/${order.id}`}>
                  <strong>Заказ #{order.number}</strong>
                </Link>
                <StatusBadge
                  value={order.priority}
                  label={PRIORITY_LABELS[order.priority]}
                />
              </div>
              <p className="task-client">{client?.storeName || client?.name}</p>
              <div className="task-warehouse">
                <Warehouse size={16} />
                {state.warehouses.find((w) => w.id === task.warehouseId)?.name}
              </div>
              <div className="task-line-preview">
                {lines.slice(0, 3).map((i) => (
                  <div key={i.id}>
                    <span>{i.name}</span>
                    <b>
                      {i.quantity} {i.unit}
                    </b>
                  </div>
                ))}
                {lines.length > 3 && (
                  <small>И ещё {lines.length - 3} позиций</small>
                )}
              </div>
              <div className="task-progress">
                <div>
                  <span>Собрано</span>
                  <strong>
                    {picked} / {qty}
                  </strong>
                </div>
                <div className="load-track">
                  <i
                    style={{ width: `${(picked / Math.max(1, qty)) * 100}%` }}
                  />
                </div>
              </div>
              <div className="task-date">
                <Clock3 size={14} />
                {formatDate(order.createdAt)}
                <Badge
                  color={task.status === "done" ? "teal" : "gray"}
                  variant="light"
                >
                  {
                    {
                      new: "Новая",
                      accepted: "Принята",
                      picking: "В сборке",
                      done: "Готово",
                    }[task.status]
                  }
                </Badge>
              </div>
              {task.status === "new" ? (
                <Button
                  fullWidth
                  variant="light"
                  onClick={() => act(() => store.acceptTask(order.id, task.id))}
                >
                  Принять задачу
                </Button>
              ) : task.status === "accepted" && task.assignedTo === user.id ? (
                <Button
                  fullWidth
                  leftSection={<Play size={16} />}
                  onClick={() => act(() => store.startTask(order.id, task.id))}
                >
                  Начать сборку
                </Button>
              ) : (
                <Button
                  component={Link}
                  to={`/orders/${order.id}`}
                  fullWidth
                  variant={task.status === "done" ? "light" : "filled"}
                  rightSection={<ArrowRight size={16} />}
                >
                  {task.status === "done"
                    ? "Посмотреть результат"
                    : "Открыть сборку"}
                </Button>
              )}
            </Paper>
          );
        })}
      </div>
      {!tasks.length && (
        <Paper className="panel empty-state">
          <CheckCheck size={35} />
          <h3>
            {filter === "done"
              ? "Завершённых задач пока нет"
              : "Все задачи разобраны"}
          </h3>
          <p>Новые заказы появятся здесь после оформления клиентом.</p>
        </Paper>
      )}
    </>
  );
}
