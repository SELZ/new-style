import { useState } from "react";
import {
  ActionIcon,
  Avatar,
  Button,
  Drawer,
  Menu,
  TextInput,
} from "@mantine/core";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Boxes,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Map,
  Menu as MenuIcon,
  PackageCheck,
  Search,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  UserRound,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  formatDate,
  ROLE_LABELS,
  store,
  useWholesale,
} from "../../../entities/wholesale/index.ts";

import { StorageStatus } from "./StorageStatus.tsx";

const links = [
  {
    to: "/dashboard",
    label: "Обзор",
    icon: LayoutDashboard,
    roles: ["client", "warehouse_worker", "manager", "admin"],
  },
  {
    to: "/catalog",
    label: "Каталог товаров",
    icon: ShoppingBag,
    roles: ["client"],
  },
  { to: "/cart", label: "Корзина", icon: ShoppingCart, roles: ["client"] },
  {
    to: "/orders",
    label: "Заказы",
    icon: ClipboardList,
    roles: ["client", "warehouse_worker", "manager", "admin"],
  },
  {
    to: "/tasks",
    label: "Сборка заказов",
    icon: PackageCheck,
    roles: ["warehouse_worker"],
  },
  { to: "/team", label: "Команда", icon: Users, roles: ["manager", "admin"] },
  {
    to: "/warehouses",
    label: "Склады",
    icon: Map,
    roles: ["warehouse_worker", "manager", "admin"],
  },
  {
    to: "/activity",
    label: "Журнал событий",
    icon: Activity,
    roles: ["client", "warehouse_worker", "manager", "admin"],
  },
  {
    to: "/admin",
    label: "Управление",
    icon: Settings2,
    roles: ["manager", "admin"],
  },
  { to: "/profile", label: "Мой магазин", icon: UserRound, roles: ["client"] },
];
export function WorkspaceShell() {
  const { state, user } = useWholesale();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobile, setMobile] = useState(false);
  const [notices, setNotices] = useState(false);
  const [search, setSearch] = useState("");
  if (!user) return null;
  const notifications = state.notifications.filter((n) => n.userId === user.id);
  const unread = notifications.filter((n) => !n.read).length;
  const count = Object.values(state.carts[user.id] ?? {}).reduce(
    (sum, value) => sum + value,
    0,
  );
  const current =
    links.find((link) => location.pathname === link.to)?.label ??
    "Карточка заказа";
  function logout() {
    store.logout();
    navigate("/login");
  }
  return (
    <div className="workspace">
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Закрыть навигацию"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`workspace-sidebar ${mobile ? "is-open" : ""}`}>
        <NavLink to="/dashboard" className="workspace-brand">
          <span>
            <Boxes size={25} />
          </span>
          BAZA
        </NavLink>
        <p className="sidebar-caption">ОПТОВАЯ ПЛАТФОРМА</p>
        <button
          className="workspace-location"
          onClick={() =>
            navigate(user.role === "client" ? "/profile" : "/warehouses")
          }
        >
          <span className="location-icon">
            <Boxes size={18} />
          </span>
          <span>
            <strong>
              {user.role === "client" ? user.storeName : "Главное пространство"}
            </strong>
            <small>{ROLE_LABELS[user.role]}</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="sidebar-section-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav aria-label="Главное меню">
          {links
            .filter(
              (link) =>
                link.roles.includes(user.role) &&
                (link.to !== "/admin" ||
                  user.role === "admin" ||
                  Object.values(user.permissions).some(Boolean)),
            )
            .map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobile(false)}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
              >
                <Icon size={19} />
                <span>{label}</span>
                {to === "/cart" && count > 0 && <b>{count}</b>}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-demo">
          <span className="status-dot" />
          Демонстрационная версия
          <p>
            Пройдите путь заказа
            <br />
            вместе со всей командой.
          </p>
          <button onClick={logout}>
            Сменить роль
            <ArrowUpRight size={15} />
          </button>
        </div>
        <button className="sidebar-user" onClick={logout}>
          <Avatar color="teal" radius="xl" size={34}>
            {user.name.slice(0, 1)}
          </Avatar>
          <span>
            <strong>{user.name}</strong>
            <small>{ROLE_LABELS[user.role]}</small>
          </span>
          <LogOut size={17} />
        </button>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="topbar-title">
            <ActionIcon
              className="mobile-menu"
              variant="subtle"
              aria-label="Открыть меню"
              onClick={() => setMobile(true)}
            >
              <MenuIcon />
            </ActionIcon>
            <span>Пространство</span>
            <span className="topbar-slash">/</span>
            <strong>{current}</strong>
          </div>
          <div className="topbar-actions">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/orders?q=${encodeURIComponent(search)}`);
              }}
            >
              <TextInput
                size="sm"
                placeholder="Найти заказ…"
                aria-label="Найти заказ"
                leftSection={<Search size={16} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
              />
            </form>
            <span className="topbar-divider" />
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label={`Уведомления: ${unread}`}
              onClick={() => setNotices(true)}
            >
              <Bell size={20} />
              {unread > 0 && (
                <span className="notification-count">{unread}</span>
              )}
            </ActionIcon>
            <Menu position="bottom-end">
              <Menu.Target>
                <button className="topbar-profile">
                  <Avatar radius="xl" color="teal" size={32}>
                    {user.name.slice(0, 1)}
                  </Avatar>
                  <ChevronDown size={14} />
                </button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user.email}</Menu.Label>
                <Menu.Item leftSection={<LogOut size={16} />} onClick={logout}>
                  Выйти / сменить роль
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        </header>
        <div className="workspace-content">
          <StorageStatus />
          <Outlet />
        </div>
        <footer className="workspace-footer">
          <span>BAZA · Управление оптовой торговлей</span>
          <span>
            <span className="status-dot" />
            Локальное демопространство
          </span>
        </footer>
      </div>
      <Drawer
        opened={notices}
        onClose={() => setNotices(false)}
        title="Уведомления"
        position="right"
        size="md"
      >
        <div className="notice-heading">
          <span className="muted">Непрочитанных: {unread}</span>
          <Button
            variant="subtle"
            size="xs"
            disabled={!unread}
            onClick={() =>
              notifications
                .filter((n) => !n.read)
                .forEach((n) => store.readNotice(n.id))
            }
          >
            Прочитать все
          </Button>
        </div>
        {notifications.length ? (
          notifications.map((n) => (
            <button
              key={n.id}
              className={`notice-item ${n.read ? "" : "unread"}`}
              onClick={() => {
                store.readNotice(n.id);
                if (n.orderId) {
                  navigate(`/orders/${n.orderId}`);
                  setNotices(false);
                }
              }}
            >
              <span className="notice-icon">
                <Bell size={17} />
              </span>
              <span>
                <strong>{n.message}</strong>
                <small>{formatDate(n.at)}</small>
              </span>
              {!n.read && <span className="status-dot" />}
            </button>
          ))
        ) : (
          <div className="empty-state">
            <Bell />
            <h3>Пока нет уведомлений</h3>
            <p>Здесь появятся обновления ваших заказов.</p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
