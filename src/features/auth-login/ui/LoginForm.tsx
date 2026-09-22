import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { sessionApi, type Session } from "../../../entities/session/index.ts";
import { getErrorMessage } from "../../../shared/api/index.ts";
import { demoAccounts, isDemoMode } from "../../../shared/config/index.ts";
import { Icon } from "../../../shared/ui/icon/index.ts";

export function LoginForm({ onLogin }: { onLogin: (session: Session) => void }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !phone.trim() || !password) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const session = await sessionApi.login(phone.trim(), password);
      setPassword("");
      onLogin(session);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
      <form className="login-form" onSubmit={submit} aria-busy={busy}>
        <span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span>
        <h2>Войти в каталог</h2>
        <p>
          {isDemoMode
            ? "Деморежим: тестовые товары и корзина."
            : "Используйте логин и пароль вашего аккаунта."}
        </p>
        {isDemoMode && (
          <div className="demo-credentials">
            <strong>Данные для входа</strong>
            {demoAccounts.map((account) => (
              <div key={account.login}>
                <code>{account.login}</code>
                <span> / </span>
                <code>{account.password}</code>
              </div>
            ))}
            <button
              className="text-button"
              type="button"
              disabled={busy}
              onClick={() => {
                setPhone(demoAccounts[0].login);
                setPassword(demoAccounts[0].password);
                setError("");
              }}
            >
              Заполнить демоданные
            </button>
          </div>
        )}
        <label>
          Телефон или логин
          <input
            name="username"
            autoComplete="username"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
        </label>
        {error && (
          <p className="request-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button"
          disabled={busy || !phone.trim() || !password}
        >
          {busy ? "Входим…" : "Войти"}
          <Icon name="arrow" size={18} />
        </button>
      </form>
  );
}
