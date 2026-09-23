import { Avatar, Badge, Paper } from "@mantine/core";
import { Clock3, PackageCheck, Users } from "lucide-react";
import { useWholesale } from "../../../entities/wholesale/index.ts";
export function TeamPage() {
  const { state } = useWholesale();
  const workers = state.users.filter((u) => u.role === "warehouse_worker");
  const all = state.orders.flatMap((o) => o.tasks);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ЛЮДИ И ПРОЦЕССЫ</span>
          <h1>
            Команда<span className="heading-dot">.</span>
          </h1>
          <p>
            Загрузка сотрудников и результаты реальных сборок в
            демопространстве.
          </p>
        </div>
        <Badge size="lg" variant="light">
          {workers.filter((w) => w.active).length} активных сотрудников
        </Badge>
      </div>
      <div className="team-grid">
        {workers.map((worker) => {
          const tasks = all.filter((t) => t.assignedTo === worker.id);
          const done = tasks.filter((t) => t.status === "done");
          const today = done.filter(
            (t) =>
              t.completedAt &&
              new Date(t.completedAt).toDateString() ===
                new Date().toDateString(),
          );
          const timed = done.filter((t) => t.startedAt && t.completedAt);
          const minutes = timed.length
            ? Math.round(
                timed.reduce(
                  (sum, t) =>
                    sum +
                    (new Date(t.completedAt!).getTime() -
                      new Date(t.startedAt!).getTime()) /
                      60000,
                  0,
                ) / timed.length,
              )
            : null;
          const active = tasks.filter((t) => t.status !== "done");
          return (
            <Paper className="panel team-card" key={worker.id}>
              <div className="team-person">
                <Avatar size={52} radius="xl" color="teal">
                  {worker.name.slice(0, 1)}
                </Avatar>
                <div>
                  <h2>{worker.name}</h2>
                  <p>{worker.email}</p>
                </div>
                <span
                  className={worker.active ? "status-dot" : "inactive-dot"}
                />
              </div>
              <p className="team-warehouses">
                {state.warehouses
                  .filter((w) => worker.warehouseIds.includes(w.id))
                  .map((w) => w.name)
                  .join(" · ") || "Склады не назначены"}
              </p>
              <div className="team-stats">
                <div>
                  <PackageCheck size={18} />
                  <strong>{today.length}</strong>
                  <span>собрано сегодня</span>
                </div>
                <div>
                  <Clock3 size={18} />
                  <strong>{minutes === null ? "—" : `${minutes} мин`}</strong>
                  <span>среднее время</span>
                </div>
              </div>
              <div className="team-active">
                <span>Задач в работе</span>
                <Badge variant="light">{active.length}</Badge>
              </div>
            </Paper>
          );
        })}
      </div>
      {!workers.length && (
        <Paper className="panel empty-state">
          <Users />
          <h3>Сотрудников пока нет</h3>
          <p>Создайте их в разделе управления.</p>
        </Paper>
      )}
    </>
  );
}
