import { useState } from "react";
import { Paper, TextInput } from "@mantine/core";
import { Activity, Search } from "lucide-react";
import { Link } from "react-router-dom";
import {
  formatDate,
  useWholesale,
  visibleOrders,
} from "../../../entities/wholesale/index.ts";
export function ActivityPage() {
  const { state, user } = useWholesale();
  const [search, setSearch] = useState("");
  if (!user) return null;
  const orderIds = new Set(visibleOrders(state, user).map((o) => o.id));
  const events = state.events.filter((e) => {
    if (
      user.role === "client" &&
      e.actorId !== user.id &&
      (!e.orderId || !orderIds.has(e.orderId))
    )
      return false;
    if (
      user.role === "warehouse_worker" &&
      ((e.warehouseId && !user.warehouseIds.includes(e.warehouseId)) ||
        (!e.warehouseId &&
          e.actorId !== user.id &&
          (!e.orderId || !orderIds.has(e.orderId))))
    )
      return false;
    return e.message.toLowerCase().includes(search.toLowerCase());
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ПРОЗРАЧНОСТЬ НА КАЖДОМ ЭТАПЕ</span>
          <h1>
            Журнал событий<span className="heading-dot">.</span>
          </h1>
          <p>История действий команды, заказов и изменений в системе.</p>
        </div>
        <TextInput
          aria-label="Поиск событий"
          placeholder="Найти событие…"
          leftSection={<Search size={17} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
      </div>
      <Paper className="panel">
        {events.length ? (
          <div className="activity-list">
            {events.map((e) => (
              <div key={e.id}>
                <span className="activity-icon">
                  <Activity size={18} />
                </span>
                <div>
                  <strong>{e.message}</strong>
                  <p>
                    {state.users.find((u) => u.id === e.actorId)?.name ??
                      "Система"}
                    {e.orderId && (
                      <>
                        {" "}
                        · <Link to={`/orders/${e.orderId}`}>Открыть заказ</Link>
                      </>
                    )}
                  </p>
                </div>
                <time>{formatDate(e.at)}</time>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Activity />
            <h3>Событий пока нет</h3>
            <p>Действия в системе будут записываться здесь.</p>
          </div>
        )}
      </Paper>
    </>
  );
}
