import { isDemoMode } from "../../../shared/config/index.ts";
import { Brand } from "../../../shared/ui/brand/index.ts";
import { Icon } from "../../../shared/ui/icon/index.ts";

type SiteHeaderProps = {
  count: number;
  loading: boolean;
  busy: boolean;
  onCatalog: () => void;
  onCart: () => void;
  onLogout: () => void;
};

export default function SiteHeader({
  count,
  loading,
  busy,
  onCatalog,
  onCart,
  onLogout,
}: SiteHeaderProps) {
  return (
    <>
      <a className="skip-link" href="#catalog">
        Перейти к каталогу
      </a>
      <div className="announcement-bar">
        <span>
          {isDemoMode
            ? "Деморежим · тестовые данные"
            : "Каталог для вашего бизнеса"}
        </span>
        <span className="announcement-detail">
          Товары и цены вашего аккаунта
        </span>
      </div>
      <header className="site-header">
        <div className="header-inner">
          <button
            type="button"
            className="brand-button"
            aria-label="NEW STYLE — каталог"
            onClick={onCatalog}
          >
            <Brand />
          </button>
          <nav className="desktop-nav" aria-label="Основная навигация">
            <button type="button" className="is-active" onClick={onCatalog}>
              Каталог
            </button>
          </nav>
          <div className="header-actions">
            <button type="button" className="cart-trigger" onClick={onCart}>
              <Icon name="bag" size={20} />
              <span>Корзина</span>
              <span className="cart-count">{loading ? "…" : count}</span>
            </button>
            <button
              type="button"
              className="text-button logout-button"
              onClick={onLogout}
              disabled={busy}
            >
              Выйти
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
