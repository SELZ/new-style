import { useState } from "react";
import { Alert, Button, PasswordInput, TextInput } from "@mantine/core";
import {
  ArrowRight,
  Boxes,
  Check,
  PackageCheck,
  ShieldCheck,
  Store,
  Warehouse,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { store, useWholesale } from "../../../entities/wholesale/index.ts";

const accounts = [
  {
    email: "client@test.com",
    name: "Клиент",
    hint: "Каталог и заказы",
    icon: Store,
  },
  {
    email: "worker1@test.com",
    name: "Склад напитков",
    hint: "worker1@test.com",
    icon: Warehouse,
  },
  {
    email: "worker2@test.com",
    name: "Склад снеков",
    hint: "worker2@test.com",
    icon: Warehouse,
  },
  {
    email: "worker3@test.com",
    name: "Бытовая химия",
    hint: "worker3@test.com",
    icon: Warehouse,
  },
  {
    email: "manager@test.com",
    name: "Менеджер",
    hint: "Контроль операций",
    icon: PackageCheck,
  },
  {
    email: "admin@test.com",
    name: "Администратор",
    hint: "Управление системой",
    icon: ShieldCheck,
  },
];
export function SignInPage() {
  const { user } = useWholesale();
  const navigate = useNavigate();
  const [email, setEmail] = useState("client@test.com");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  if (user)
    return (
      <Navigate
        to={
          user.role === "client"
            ? "/catalog"
            : user.role === "warehouse_worker"
              ? "/tasks"
              : "/dashboard"
        }
        replace
      />
    );
  return (
    <main className="erp-login">
      <section className="erp-login-story">
        <div className="workspace-brand">
          <span>
            <Boxes size={25} />
          </span>
          BAZA<span className="brand-tag">ОПТ & СКЛАД</span>
        </div>
        <div>
          <div className="login-kicker">ОДНА СИСТЕМА. ВСЯ КОМАНДА.</div>
          <h1>
            От первого заказа
            <br />
            до последней
            <br />
            <em>собранной коробки.</em>
          </h1>
          <p>Магазины, склады и ваша команда — в одном рабочем пространстве.</p>
          <div className="login-flow">
            <span>
              <Store size={21} />
              Заказ
            </span>
            <ArrowRight size={17} />
            <span>
              <Warehouse size={21} />
              Сборка
            </span>
            <ArrowRight size={17} />
            <span>
              <Check size={21} />
              Доставка
            </span>
          </div>
        </div>
        <small>Демонстрационная версия · Общее пространство для всей команды</small>
      </section>
      <section className="erp-login-panel">
        <div className="login-form-wrap">
          <span className="eyebrow">ДОБРО ПОЖАЛОВАТЬ</span>
          <h2>Войти в BAZA</h2>
          <p className="muted">
            Выберите аккаунт — логин и пароль заполнятся автоматически.
          </p>
          <div className="role-choices">
            {accounts.map(({ email: value, name, hint, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={email === value}
                className={
                  email === value ? "role-choice selected" : "role-choice"
                }
                onClick={() => {
                  setEmail(value);
                  setPassword("demo123");
                  setError("");
                }}
              >
                <Icon size={20} />
                <span>
                  <strong>{name}</strong>
                  <small>{hint}</small>
                </span>
                {email === value && <Check size={16} />}
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              try {
                const account = store.login(email.trim(), password);
                navigate(
                  account.role === "client"
                    ? "/catalog"
                    : account.role === "warehouse_worker"
                      ? "/tasks"
                      : "/dashboard",
                );
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : "Не удалось войти",
                );
              }
            }}
          >
            <TextInput
              label="Логин"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Пароль"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />
            {error && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}
            <Button
              type="submit"
              fullWidth
              size="md"
              rightSection={<ArrowRight size={18} />}
            >
              Войти в пространство
            </Button>
          </form>
          <div className="demo-login-note">
            Пароль всех демоаккаунтов: <code>demo123</code>
          </div>
        </div>
      </section>
    </main>
  );
}
