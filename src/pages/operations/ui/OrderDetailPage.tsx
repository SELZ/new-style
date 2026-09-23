import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Modal,
  NumberInput,
  Paper,
} from "@mantine/core";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  MapPin,
  Package,
  Truck,
  UserRound,
  Warehouse,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  formatDate,
  money,
  orderProgress,
  PRIORITY_LABELS,
  STATUS_LABELS,
  store,
  useWholesale,
  visibleOrders,
} from "../../../entities/wholesale/index.ts";
import { StatusBadge } from "../../../shared/ui/status-badge/index.ts";

const stages = [
  "new",
  "accepted",
  "picking",
  "ready",
  "manager",
  "shipped",
  "completed",
] as const;
export function OrderDetailPage() {
  const { id } = useParams();
  const { state, user } = useWholesale();
  const [error, setError] = useState("");
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  if (!user) return null;
  const order = visibleOrders(state, user).find((o) => o.id === id);
  if (!order)
    return (
      <Paper className="panel empty-state">
        <Package size={36} />
        <h2>Заказ не найден</h2>
        <p>
          Он недоступен для вашей роли или был удалён при сбросе демоданных.
        </p>
        <Button component={Link} to="/orders" mt="md">
          К заказам
        </Button>
      </Paper>
    );
  const client = state.users.find((u) => u.id === order.clientId);
  const worker = user.role === "warehouse_worker";
  const manager = user.role === "manager" || user.role === "admin";
  const tasks = order.tasks.filter(
    (t) => !worker || user.warehouseIds.includes(t.warehouseId),
  );
  const missing = order.items.reduce((sum, i) => sum + i.missing, 0);
  const complete = order.tasks.every((t) => t.status === "done");
  const current = stages.findIndex((stage) => stage === order.status);
  const final = ["manager", "shipped", "completed"].includes(order.status);
  const assignedWorker = worker && order.tasks.some(
    (task) => task.assignedTo === user.id && user.warehouseIds.includes(task.warehouseId),
  );
  function act(fn: () => void) {
    try {
      fn();
      setError("");
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось выполнить действие",
      );
      return false;
    }
  }
  return (
    <>
      <Link to={worker ? "/tasks" : "/orders"} className="back-link">
        <ArrowLeft size={16} />
        Назад к {worker ? "сборкам" : "заказам"}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{formatDate(order.createdAt)}</span>
          <h1>
            Заказ #{order.number}
            <span className="heading-dot">.</span>
          </h1>
          <div className="heading-badges">
            <StatusBadge
              value={order.status}
              label={STATUS_LABELS[order.status]}
            />
            <StatusBadge
              value={order.priority}
              label={PRIORITY_LABELS[order.priority]}
            />
          </div>
        </div>
        <div className="heading-buttons">
          {complete && order.status === "ready" && (manager || assignedWorker) && (
            <Button
              rightSection={<ArrowRight size={17} />}
              onClick={() => act(() => store.handoff(order.id))}
            >
              Передать менеджеру
            </Button>
          )}
          {manager && order.status === "manager" && (
            <Button
              leftSection={<Truck size={18} />}
              onClick={() => {
                setError("");
                setShippingOrderId(order.id);
              }}
            >
              Отправить клиенту
            </Button>
          )}
          {(manager || user.role === "client") &&
            order.status === "shipped" && (
              <Button
                leftSection={<Check size={18} />}
                onClick={() => act(() => store.complete(order.id))}
              >
                {user.role === "client"
                  ? "Подтвердить получение"
                  : "Завершить заказ"}
              </Button>
            )}
        </div>
      </div>
      {error && (
        <Alert color="red" role="alert" mb="md">
          {error}
        </Alert>
      )}
      {missing > 0 && (
        <Alert color="orange" mb="md" title="Есть отсутствующие товары">
          Не найдено единиц: {missing}. При передаче и отгрузке проверьте
          фактически собранный состав заказа.
        </Alert>
      )}
      <Paper className="panel order-stages">
        {stages.map((stage, index) => (
          <div
            key={stage}
            className={`${index <= current ? "reached" : ""} ${stage === order.status ? "current" : ""}`}
          >
            <span>{index < current ? <Check size={13} /> : index + 1}</span>
            <small>{STATUS_LABELS[stage]}</small>
          </div>
        ))}
      </Paper>
      <div className="order-detail-layout">
        <div className="order-detail-tasks">
          {tasks.map((task) => {
            const warehouse = state.warehouses.find(
              (w) => w.id === task.warehouseId,
            );
            const lines = order.items.filter(
              (i) => i.warehouseId === task.warehouseId,
            );
            const assigned = state.users.find((u) => u.id === task.assignedTo);
            const canPick =
              worker &&
              task.status === "picking" &&
              task.assignedTo === user.id &&
              !final;
            const resolved = lines.every(
              (i) => i.picked + i.missing === i.quantity,
            );
            return (
              <Paper className="panel warehouse-task" key={task.id}>
                <div className="panel-heading">
                  <div className="warehouse-title">
                    <span
                      className="warehouse-icon"
                      style={{
                        color: warehouse?.color,
                        background: (warehouse?.color ?? "#137c66") + "16",
                      }}
                    >
                      <Warehouse size={22} />
                    </span>
                    <div>
                      <h2>{warehouse?.name}</h2>
                      <p>
                        {assigned
                          ? `Сборщик: ${assigned.name}`
                          : "Ожидает принятия"}{" "}
                        · {lines.length} позиций
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="light"
                    color={task.status === "done" ? "teal" : "gray"}
                  >
                    {
                      {
                        new: "Новая задача",
                        accepted: "Принята",
                        picking: "В сборке",
                        done: "Сборка завершена",
                      }[task.status]
                    }
                  </Badge>
                </div>
                <div className="picking-list">
                  {lines.map((item) => {
                    const product = state.products.find(
                      (p) => p.id === item.productId,
                    );
                    return (
                      <div
                        className={`picking-item ${item.picked === item.quantity ? "picked" : ""}`}
                        key={item.id}
                      >
                        <img
                          src={item.image}
                          alt=""
                          onError={(e) => {
                            if (e.currentTarget.getAttribute("src") !== "/products/towels.svg") {
                              e.currentTarget.src = "/products/towels.svg";
                            } else {
                              e.currentTarget.style.visibility = "hidden";
                            }
                          }}
                        />
                        <div className="picking-item-info">
                          <strong>{item.name}</strong>
                          <small>
                            {product
                              ? `Стеллаж ${product.location.rack} · Полка ${product.location.shelf}`
                              : "Место хранения не указано"}
                          </small>
                          <span>
                            {item.quantity} {item.unit}
                            {!worker &&
                              ` · ${money(item.quantity * item.price)}`}
                          </span>
                        </div>
                        {worker ? (
                          <div className="picking-controls">
                            <Checkbox
                              label="Собрано"
                              aria-label={`Собрано: ${item.name}`}
                              checked={item.picked === item.quantity}
                              disabled={!canPick}
                              onChange={(e) =>
                                act(() =>
                                  store.setPicked(
                                    order.id,
                                    item.id,
                                    e.currentTarget.checked ? item.quantity : 0,
                                    0,
                                  ),
                                )
                              }
                            />
                            <div className="picking-quantity">
                              <NumberInput
                                aria-label={`Собрано количество: ${item.name}`}
                                min={0}
                                max={item.quantity}
                                allowDecimal={false}
                                value={item.picked}
                                disabled={!canPick}
                                onChange={(value) => {
                                  if (typeof value === "number")
                                    act(() =>
                                      store.setPicked(
                                        order.id,
                                        item.id,
                                        value,
                                        Math.min(
                                          item.missing,
                                          item.quantity - value,
                                        ),
                                      ),
                                    );
                                }}
                              />
                              <span>/ {item.quantity}</span>
                            </div>
                            <Button
                              size="compact-xs"
                              color={item.missing ? "orange" : "gray"}
                              variant="subtle"
                              disabled={
                                !canPick || item.picked === item.quantity
                              }
                              onClick={() =>
                                act(() =>
                                  store.setPicked(
                                    order.id,
                                    item.id,
                                    item.picked,
                                    item.missing
                                      ? 0
                                      : item.quantity - item.picked,
                                  ),
                                )
                              }
                            >
                              {item.missing
                                ? `Нет: ${item.missing} · отменить`
                                : "Указать отсутствие"}
                            </Button>
                          </div>
                        ) : (
                          <div className="picking-result">
                            <strong>
                              {item.picked} / {item.quantity}
                            </strong>
                            <small>
                              {item.missing
                                ? `Нет в наличии: ${item.missing}`
                                : item.picked === item.quantity
                                  ? "Собрано"
                                  : "Ожидает сборки"}
                            </small>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {worker && !final && (
                  <div className="task-actions">
                    {task.status === "new" && !task.assignedTo && (
                      <Button
                        variant="light"
                        onClick={() =>
                          act(() => store.acceptTask(order.id, task.id))
                        }
                      >
                        Принять задачу
                      </Button>
                    )}
                    {task.status === "accepted" &&
                      task.assignedTo === user.id && (
                        <Button
                          onClick={() =>
                            act(() => store.startTask(order.id, task.id))
                          }
                        >
                          Начать сборку
                        </Button>
                      )}
                    {canPick && (
                      <>
                        <span className="muted">
                          Отметьте количество или отсутствие каждой позиции
                        </span>
                        <Button
                          disabled={!resolved}
                          leftSection={<CircleCheck size={17} />}
                          onClick={() =>
                            act(() => store.finishTask(order.id, task.id))
                          }
                        >
                          Завершить сборку
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </Paper>
            );
          })}
        </div>
        <aside className="order-side">
          <Paper className="panel">
            <h2>Информация о заказе</h2>
            <div className="order-info-row">
              <UserRound size={17} />
              <div>
                <strong>{client?.storeName || client?.name}</strong>
                <small>
                  {client?.name}
                  <br />
                  {client?.phone}
                </small>
              </div>
            </div>
            <div className="order-info-row">
              <MapPin size={18} />
              <div>
                <strong>Адрес доставки</strong>
                <small>{order.address}</small>
              </div>
            </div>
            {order.comment && (
              <div className="order-comment">
                <strong>Комментарий</strong>
                <p>{order.comment}</p>
              </div>
            )}
            <div className="detail-summary">
              <div>
                <span>Складов в заказе</span>
                <b>{order.tasks.length}</b>
              </div>
              <div>
                <span>Собрано товаров</span>
                <b>{orderProgress(order)}%</b>
              </div>
              {!worker && (
                <>
                  <div>
                    <span>Сумма заказа</span>
                    <b>{money(order.total)}</b>
                  </div>
                  {missing > 0 && (
                    <div>
                      <span>Собрано на сумму</span>
                      <b>
                        {money(
                          order.items.reduce(
                            (s, i) => s + i.picked * i.price,
                            0,
                          ),
                        )}
                      </b>
                    </div>
                  )}
                </>
              )}
            </div>
          </Paper>
          <Paper className="panel">
            <h2>История заказа</h2>
            <div className="event-timeline">
              {state.events
                .filter(
                  (e) =>
                    e.orderId === order.id &&
                    (!worker ||
                      !e.warehouseId ||
                      user.warehouseIds.includes(e.warehouseId)),
                )
                .slice(0, 10)
                .map((event) => (
                  <div key={event.id}>
                    <i />
                    <span>
                      <strong>{event.message}</strong>
                      <small>{formatDate(event.at)}</small>
                    </span>
                  </div>
                ))}
            </div>
          </Paper>
        </aside>
      </div>
      <Modal
        opened={shippingOrderId === order.id && manager && order.status === "manager"}
        onClose={() => setShippingOrderId(null)}
        title="Подтвердить отгрузку"
        centered
      >
        <p>Заказ #{order.number} будет передан клиенту.</p>
        {error && <Alert color="red" role="alert" my="md">{error}</Alert>}
        {missing > 0 && (
          <Alert color="orange" my="md">
            Зафиксирована недостача: {missing} единиц. Будут отгружены
            только собранные товары.
          </Alert>
        )}
        <div className="modal-actions">
          <Button variant="default" onClick={() => setShippingOrderId(null)}>
            Отмена
          </Button>
          <Button
            onClick={() => {
              if (act(() => store.ship(order.id))) setShippingOrderId(null);
            }}
          >
            Подтвердить отгрузку
          </Button>
        </div>
      </Modal>
    </>
  );
}
