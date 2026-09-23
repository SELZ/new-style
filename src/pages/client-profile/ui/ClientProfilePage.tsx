import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, TextInput, Textarea } from "@mantine/core";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Clock3,
  Crown,
  Mail,
  MapPin,
  Phone,
  Save,
  ShoppingBag,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  formatDate,
  money,
  STATUS_LABELS,
  store,
  TIER_LABELS,
  useWholesale,
} from "../../../entities/wholesale/index.ts";
import type { User } from "../../../entities/wholesale/index.ts";
import { StatusBadge } from "../../../shared/ui/status-badge/index.ts";
import "./client-profile.css";

type ProfileValues = Pick<
  User,
  "storeName" | "name" | "phone" | "email" | "address"
>;
function profileValues(user: User): ProfileValues {
  return {
    storeName: user.storeName,
    name: user.name,
    phone: user.phone,
    email: user.email,
    address: user.address,
  };
}

function ProfileForm({ user }: { user: User }) {
  const [values, setValues] = useState(() => profileValues(user));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const pending = useRef(false);
  const dirty = Object.keys(values).some(
    (key) =>
      values[key as keyof ProfileValues] !== user[key as keyof ProfileValues],
  );

  function change(field: keyof ProfileValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setSaved(false);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const trimmed = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value.trim()]),
      ) as ProfileValues;
      await store.updateProfile(trimmed);
      setValues(trimmed);
      setSaved(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось сохранить профиль.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      className="client-profile-form"
      onSubmit={(event) => void submit(event)}
    >
      <div className="client-profile-section-heading">
        <div>
          <h2>Данные магазина</h2>
          <p>Контакты для связи и доставки ваших заказов.</p>
        </div>
        <Store size={21} />
      </div>
      {error && (
        <Alert color="red" className="client-profile-form-message">
          {error}
        </Alert>
      )}
      {saved && (
        <Alert
          color="teal"
          icon={<Check size={17} />}
          className="client-profile-form-message"
        >
          Изменения сохранены.
        </Alert>
      )}
      <TextInput
        label="Название магазина"
        value={values.storeName}
        onChange={(event) => change("storeName", event.currentTarget.value)}
        leftSection={<Store size={16} />}
        required
        autoComplete="organization"
        disabled={busy}
      />
      <TextInput
        label="Контактное лицо"
        value={values.name}
        onChange={(event) => change("name", event.currentTarget.value)}
        leftSection={<UserRound size={16} />}
        required
        autoComplete="name"
        disabled={busy}
      />
      <TextInput
        label="Телефон"
        type="tel"
        value={values.phone}
        onChange={(event) => change("phone", event.currentTarget.value)}
        leftSection={<Phone size={16} />}
        autoComplete="tel"
        disabled={busy}
      />
      <TextInput
        label="Email"
        type="email"
        value={values.email}
        onChange={(event) => change("email", event.currentTarget.value)}
        leftSection={<Mail size={16} />}
        required
        autoComplete="email"
        disabled={busy}
      />
      <Textarea
        label="Адрес доставки"
        value={values.address}
        onChange={(event) => change("address", event.currentTarget.value)}
        autoComplete="street-address"
        minRows={3}
        disabled={busy}
        className="client-profile-address"
      />
      <div className="client-profile-form-footer">
        <p>
          <MapPin size={14} />
          Адрес будет предложен при оформлении заказа.
        </p>
        <div>
          <Button
            type="button"
            variant="subtle"
            color="gray"
            disabled={!dirty || busy}
            onClick={() => {
              setValues(profileValues(user));
              setError("");
              setSaved(false);
            }}
          >
            Отменить
          </Button>
          <Button
            type="submit"
            leftSection={<Save size={16} />}
            loading={busy}
            disabled={!dirty}
          >
            Сохранить
          </Button>
        </div>
      </div>
    </form>
  );
}

export default function ClientProfilePage() {
  const { state, user } = useWholesale();
  if (!user) return null;
  const orders = state.orders
    .filter((order) => order.clientId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activeOrders = orders.filter((order) => order.status !== "completed");
  const completedOrders = orders.filter(
    (order) => order.status === "completed",
  );
  const orderTotal = orders.reduce((sum, order) => sum + order.total, 0);
  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="client-profile-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span>
          <h1>Профиль магазина</h1>
          <p>Ваши контакты, заказы и история сотрудничества.</p>
        </div>
      </div>
      <div className="client-profile-overview">
        <div className="client-profile-avatar">
          {initials || <UserRound size={30} />}
        </div>
        <div className="client-profile-identity">
          <div>
            <h2>{user.storeName || user.name}</h2>
            <Badge
              color={user.tier === "vip" ? "yellow" : "teal"}
              variant="light"
              leftSection={
                user.tier === "vip" ? <Crown size={12} /> : undefined
              }
            >
              {TIER_LABELS[user.tier]} клиент
            </Badge>
          </div>
          <p>{user.name}</p>
          <span>
            <Mail size={13} />
            {user.email}
          </span>
        </div>
        <Button
          component={Link}
          to="/catalog"
          variant="light"
          rightSection={<ArrowRight size={16} />}
        >
          Новый заказ
        </Button>
      </div>
      <div className="client-profile-stats">
        <div>
          <span className="client-profile-stat-icon">
            <ShoppingBag size={20} />
          </span>
          <div>
            <span>Всего заказов</span>
            <strong>{orders.length}</strong>
          </div>
        </div>
        <div>
          <span className="client-profile-stat-icon">
            <Clock3 size={20} />
          </span>
          <div>
            <span>В работе</span>
            <strong>{activeOrders.length}</strong>
          </div>
        </div>
        <div>
          <span className="client-profile-stat-icon">
            <Check size={20} />
          </span>
          <div>
            <span>Завершено</span>
            <strong>{completedOrders.length}</strong>
          </div>
        </div>
        <div>
          <span className="client-profile-stat-icon">
            <Wallet size={20} />
          </span>
          <div>
            <span>Сумма заказов</span>
            <strong>{money(orderTotal)}</strong>
          </div>
        </div>
      </div>
      <div className="client-profile-layout">
        <ProfileForm key={user.id} user={user} />
        <aside className="client-profile-side">
          <section className="client-profile-order-links">
            <span className="eyebrow">ВСЕГДА ПОД РУКОЙ</span>
            <h2>Мои заказы</h2>
            <Link to="/orders?status=active">
              <span className="client-profile-link-icon">
                <ClipboardList size={20} />
              </span>
              <span>
                <strong>Текущие заказы</strong>
                <small>{activeOrders.length} в работе</small>
              </span>
              <ArrowRight size={17} />
            </Link>
            <Link to="/orders?status=completed">
              <span className="client-profile-link-icon">
                <Clock3 size={20} />
              </span>
              <span>
                <strong>История заказов</strong>
                <small>Завершено: {completedOrders.length}</small>
              </span>
              <ArrowRight size={17} />
            </Link>
          </section>
          <section className="client-profile-tier">
            <Crown size={27} strokeWidth={1.3} />
            <span>СТАТУС КЛИЕНТА</span>
            <h2>{TIER_LABELS[user.tier]}</h2>
            <p>
              Статус вашего магазина назначает менеджер. За контактными данными
              и адресом доставки вы можете следить здесь.
            </p>
          </section>
        </aside>
      </div>
      <section className="client-profile-recent">
        <div className="client-profile-section-heading">
          <div>
            <h2>Последние заказы</h2>
            <p>Статусы и детали ваших последних покупок.</p>
          </div>
          <Button
            component={Link}
            to="/orders"
            variant="subtle"
            size="xs"
            rightSection={<ArrowRight size={14} />}
          >
            Все заказы
          </Button>
        </div>
        {orders.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Заказ</th>
                  <th>Дата</th>
                  <th>Статус</th>
                  <th>Сумма</th>
                  <th>
                    <span className="client-profile-visually-hidden">
                      Подробнее
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/orders/${order.id}`}>№ {order.number}</Link>
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <StatusBadge
                        value={order.status}
                        label={STATUS_LABELS[order.status]}
                      />
                    </td>
                    <td>{money(order.total)}</td>
                    <td>
                      <Link
                        aria-label={`Открыть заказ № ${order.number}`}
                        to={`/orders/${order.id}`}
                      >
                        <ArrowRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="client-profile-no-orders">
            <PackageEmpty />
            <p>Ваш первый заказ появится здесь.</p>
            <Button component={Link} to="/catalog" variant="light" size="sm">
              Открыть каталог
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function PackageEmpty() {
  return <ShoppingBag size={31} strokeWidth={1.4} />;
}
