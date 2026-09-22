import type { Session } from "../../../entities/session/index.ts";
import { LoginForm } from "../../../features/auth-login/index.ts";
import { Brand } from "../../../shared/ui/brand/index.ts";

export function LoginPage({ onLogin }: { onLogin: (session: Session) => void }) {
  return <main className="login-page">
    <div className="login-intro">
      <Brand />
      <span className="eyebrow">КАТАЛОГ ДЛЯ ВАШЕГО БИЗНЕСА</span>
      <h1>Всё для заказа.<br /><span>В одном месте.</span></h1>
      <p>Категории, товары и актуальные цены из вашего личного кабинета.</p>
    </div>
    <LoginForm onLogin={onLogin} />
  </main>;
}
