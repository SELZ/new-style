import { ArrowUpRight, Package } from "lucide-react";
import { Link } from "react-router-dom";
import {
  formatDate,
  money,
  orderProgress,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Order,
  type State,
  type User,
} from "../../../entities/wholesale/index.ts";
import { StatusBadge } from "../../../shared/ui/status-badge/index.ts";

export function OrderTable({
  orders,
  state,
  user,
}: {
  orders: Order[];
  state: State;
  user: User;
}) {
  if (!orders.length)
    return (
      <div className="empty-state">
        <Package size={30} />
        <h3>Заказов пока нет</h3>
        <p>Новые заказы появятся здесь автоматически.</p>
      </div>
    );
  return (
    <div className="table-scroll">
      <table className="erp-table">
        <thead>
          <tr>
            <th>Заказ / дата</th>
            {user.role !== "client" && <th>Клиент</th>}
            <th>Приоритет</th>
            <th>Статус</th>
            <th>Сборка</th>
            {user.role !== "warehouse_worker" && <th>Сумма</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const client = state.users.find((u) => u.id === order.clientId);
            return (
              <tr key={order.id}>
                <td>
                  <Link to={`/orders/${order.id}`} className="order-number">
                    #{order.number}
                  </Link>
                  <small>{formatDate(order.createdAt)}</small>
                </td>
                {user.role !== "client" && (
                  <td>
                    <strong>
                      {client?.storeName || client?.name || "Клиент"}
                    </strong>
                    <small>{client?.name}</small>
                  </td>
                )}
                <td>
                  <StatusBadge
                    value={order.priority}
                    label={PRIORITY_LABELS[order.priority]}
                  />
                </td>
                <td>
                  <StatusBadge
                    value={order.status}
                    label={STATUS_LABELS[order.status]}
                  />
                </td>
                <td>
                  <div className="table-progress">
                    <span>
                      <i style={{ width: `${orderProgress(order)}%` }} />
                    </span>
                    <small>{orderProgress(order)}%</small>
                  </div>
                </td>
                {user.role !== "warehouse_worker" && (
                  <td className="money-cell">{money(order.total)}</td>
                )}
                <td>
                  <Link
                    to={`/orders/${order.id}`}
                    className="table-open"
                    aria-label={`Открыть заказ ${order.number}`}
                  >
                    <ArrowUpRight size={18} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
