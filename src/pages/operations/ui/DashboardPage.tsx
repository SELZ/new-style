import { useEffect, useState } from "react";
import { Badge, Button, Paper } from "@mantine/core";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  ChartNoAxesCombined,
  Clock3,
  Plus,
  ShoppingBag,
  Warehouse,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  money,
  useWholesale,
  visibleOrders,
  visibleTasks,
} from "../../../entities/wholesale/index.ts";
import { OrderTable } from "./OrderTable.tsx";

export function DashboardPage() {
  const { state, user } = useWholesale();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  if (!user) return null;
  const orders = visibleOrders(state, user);
  const tasks = visibleTasks(state, user);
  const today = new Date().toDateString();
  const todayOrders = orders.filter(
    (o) => new Date(o.createdAt).toDateString() === today,
  );
  const activeTasks = tasks.filter(({ task }) => task.status !== "done");
  const sales = orders
    .filter((o) => ["shipped", "completed"].includes(o.status))
    .reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.picked * i.price, 0),
      0,
    );
  const warehouses = state.warehouses.filter(
    (w) => user.role !== "warehouse_worker" || user.warehouseIds.includes(w.id),
  );
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const matches = orders.filter(
      (o) => new Date(o.createdAt).toDateString() === date.toDateString(),
    );
    return {
      label: date.toLocaleDateString("ru-RU", { weekday: "short" }),
      count: matches.length,
      amount: matches.reduce((sum, o) => sum + o.total, 0),
    };
  });
  const max = Math.max(1, ...days.map((d) => d.amount));
  const delayed = activeTasks.filter(
    ({ order }) => now - new Date(order.createdAt).getTime() > 30 * 60000,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ВСЁ ПОД КОНТРОЛЕМ</span>
          <h1>
            Обзор пространства<span className="heading-dot">.</span>
          </h1>
          <p>
            Здравствуйте, {user.name.split(" ")[0]}. Вот что происходит сегодня.
          </p>
        </div>
        <Button
          component={Link}
          to={
            user.role === "client"
              ? "/catalog"
              : user.role === "warehouse_worker"
                ? "/tasks"
                : "/orders"
          }
          leftSection={
            user.role === "client" ? (
              <Plus size={17} />
            ) : (
              <ArrowUpRight size={17} />
            )
          }
        >
          {user.role === "client"
            ? "Создать заказ"
            : user.role === "warehouse_worker"
              ? "К сборке"
              : "Все заказы"}
        </Button>
      </div>
      <div className="stat-grid">
        {[
          {
            label: "Заказов сегодня",
            value: todayOrders.length,
            note: `Всего в пространстве: ${orders.length}`,
            icon: ShoppingBag,
            color: "teal",
          },
          {
            label: "Сумма отгрузок",
            value: money(sales),
            note: "По собранным и отгруженным товарам",
            icon: ChartNoAxesCombined,
            color: "blue",
          },
          {
            label: "Активные сборки",
            value: activeTasks.length,
            note: `Готовых задач: ${tasks.filter((t) => t.task.status === "done").length}`,
            icon: Boxes,
            color: "orange",
          },
          {
            label: "Требуют внимания",
            value: delayed.length,
            note: "Задачи открыты дольше 30 минут",
            icon: Clock3,
            color: "violet",
          },
        ].map((item) => (
          <Paper className="stat-card" key={item.label}>
            <div>
              <span>{item.label}</span>
              <i className={`stat-icon ${item.color}`}>
                <item.icon size={20} />
              </i>
            </div>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </Paper>
        ))}
      </div>
      {(user.role === "manager" || user.role === "admin") &&
        delayed.length > 0 && (
          <Paper className="panel attention-panel">
            <div className="panel-heading">
              <div>
                <h2>Нужна помощь со сборкой</h2>
                <p>Эти задачи открыты больше 30 минут</p>
              </div>
              <Clock3 size={20} />
            </div>
            <div className="delayed-tasks">
              {delayed.map(({ order, task }) => (
                <Link key={task.id} to={`/orders/${order.id}`}>
                  <span>
                    <strong>Заказ #{order.number}</strong>
                    <small>
                      {
                        state.warehouses.find((w) => w.id === task.warehouseId)
                          ?.name
                      }
                    </small>
                  </span>
                  <span>
                    <b>
                      {Math.floor(
                        (now - new Date(order.createdAt).getTime()) / 60000,
                      )}{" "}
                      мин
                    </b>
                    <small>
                      {task.assignedTo
                        ? state.users.find((u) => u.id === task.assignedTo)
                            ?.name
                        : "Сборщик ещё не назначен"}
                    </small>
                  </span>
                  <ArrowRight size={17} />
                </Link>
              ))}
            </div>
          </Paper>
        )}
      <div className="dashboard-columns">
        <Paper className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Заказы за неделю</h2>
              <p>Стоимость созданных заказов</p>
            </div>
            <Badge variant="light" color="gray">
              Последние 7 дней
            </Badge>
          </div>
          <div className="chart-total">
            {money(days.reduce((sum, d) => sum + d.amount, 0))}
            <span>{days.reduce((sum, d) => sum + d.count, 0)} заказов</span>
          </div>
          <div
            className="bar-chart"
            role="img"
            aria-label={`Заказы за неделю: ${days.map((d) => `${d.label} ${d.count}`).join(", ")}`}
          >
            {days.map((d, i) => (
              <div key={i} className={i === 6 ? "today" : ""}>
                <span className="bar-tooltip">
                  {d.count} заказов · {money(d.amount)}
                </span>
                <div className="bar-track">
                  <i
                    style={{
                      height: `${Math.max(2, (d.amount / max) * 100)}%`,
                    }}
                  />
                </div>
                <small>{d.label}</small>
              </div>
            ))}
          </div>
        </Paper>
        <Paper className="panel warehouses-panel">
          <div className="panel-heading">
            <div>
              <h2>Загрузка складов</h2>
              <p>Распределение активных задач</p>
            </div>
            <Warehouse size={20} className="muted" />
          </div>
          {warehouses.map((w) => {
            const pending = activeTasks.filter(
              (t) => t.task.warehouseId === w.id,
            );
            const late = delayed.some((t) => t.task.warehouseId === w.id);
            return (
              <div className="warehouse-load" key={w.id}>
                <div>
                  <span
                    className="warehouse-icon"
                    style={{ background: w.color + "18", color: w.color }}
                  >
                    <Warehouse size={20} />
                  </span>
                  <span>
                    <strong>{w.name}</strong>
                    <small>{w.categories.join(" · ")}</small>
                  </span>
                  <b>
                    {pending.length}
                    <small>задач</small>
                  </b>
                </div>
                <div className="load-track">
                  <i
                    style={{
                      width: `${(pending.length / Math.max(1, activeTasks.length)) * 100}%`,
                      background: w.color,
                    }}
                  />
                </div>
                <p>
                  {late ? (
                    <>
                      <span className="warning-dot" />
                      Есть задачи дольше 30 минут
                    </>
                  ) : (
                    <>
                      <span className="status-dot" />
                      {pending.length
                        ? "Сборка идёт по плану"
                        : "Все задачи выполнены"}
                    </>
                  )}
                </p>
              </div>
            );
          })}
        </Paper>
      </div>
      <Paper className="panel orders-panel">
        <div className="panel-heading">
          <div>
            <h2>
              Последние заказы{" "}
              <span className="count-label">{orders.length}</span>
            </h2>
            <p>От оформления до передачи клиенту</p>
          </div>
          <Button
            variant="subtle"
            component={Link}
            to="/orders"
            rightSection={<ArrowRight size={15} />}
          >
            Все заказы
          </Button>
        </div>
        <OrderTable
          orders={[...orders]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 5)}
          state={state}
          user={user}
        />
      </Paper>
    </>
  );
}
