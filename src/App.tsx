import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api, getErrorMessage, isDemoMode } from "./api/client";
import { demoAccounts } from "./api/demo";
import type { Catalog, Category, Product, Session } from "./api/types";
import CartDrawer from "./components/CartDrawer";
import Icon from "./components/Icon";
import PriceFilter from "./components/PriceFilter";
import ProductCard from "./components/ProductCard";
import ProductDialog from "./components/ProductDialog";
import { useServerCart } from "./hooks/useServerCart";
import "./App.css";
import "./Shop.css";

type CatalogRequest = { group: string; query: string; attempt: number };
type Sort = "name" | "price-asc" | "price-desc";

function Brand() {
  return (
    <span className="brand">
      new<span className="brand-light">style</span>
      <span className="brand-period">.</span>
    </span>
  );
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
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
      const session = await api.login(phone.trim(), password);
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
    <main className="login-page">
      <div className="login-intro">
        <Brand />
        <span className="eyebrow">КАТАЛОГ ДЛЯ ВАШЕГО БИЗНЕСА</span>
        <h1>
          Всё для заказа.
          <br />
          <span>В одном месте.</span>
        </h1>
        <p>Категории, товары и актуальные цены из вашего личного кабинета.</p>
      </div>
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
    </main>
  );
}

function Shop({
  session,
  onLogout,
}: {
  session: Session;
  onLogout: () => void;
}) {
  const [trail, setTrail] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [promotionOnly, setPromotionOnly] = useState(false);
  const [result, setResult] = useState<{
    key: CatalogRequest;
    data: Catalog;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: CatalogRequest;
    message: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const filterDialog = useRef<HTMLDialogElement>(null);
  const cart = useServerCart(session.token);
  const group = trail.at(-1)?.id ?? "0";
  const requestKey = useMemo(
    () => ({ group, query, attempt }),
    [group, query, attempt],
  );
  const normalizedSearch = search.trim().replace(/\s+/g, " ");
  const searching = normalizedSearch !== query;
  const invalidQuery = query.split(" ").length > 5;
  const data = !searching && result?.key === requestKey ? result.data : null;
  const error = searching
    ? ""
    : invalidQuery
      ? "Введите не больше пяти слов для поиска."
      : !data && failure?.key === requestKey
        ? failure.message
        : "";
  const loading = !data && !error;
  const products = data?.products ?? [];
  const categories = data?.categories ?? [];

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(normalizedSearch), 350);
    return () => window.clearTimeout(timeout);
  }, [normalizedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    if (invalidQuery) return () => controller.abort();
    const request = query
      ? api.search(session.token, query, controller.signal)
      : api.catalog(session.token, group, controller.signal);
    request
      .then((response) => {
        if (!controller.signal.aborted)
          setResult({ key: requestKey, data: response });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setFailure({ key: requestKey, message: getErrorMessage(cause) });
      });
    return () => controller.abort();
  }, [session.token, group, query, requestKey, invalidQuery]);

  useEffect(() => {
    if (!announcement) return;
    const timeout = window.setTimeout(() => setAnnouncement(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [announcement]);

  const priceLimit = Math.max(
    1,
    Math.ceil(
      products.reduce(
        (highest, product) => Math.max(highest, product.price ?? 0),
        0,
      ),
    ),
  );
  const priceMax =
    maxPrice === null ? priceLimit : Math.min(maxPrice, priceLimit);
  const priceMin = Math.min(minPrice, priceMax);
  const hasPriceFilter = minPrice > 0 || maxPrice !== null;
  const visibleProducts = products
    .filter(
      (product) =>
        (!hasPriceFilter ||
          (product.price !== null &&
            product.price >= priceMin &&
            product.price <= priceMax)) &&
        (!promotionOnly || Boolean(product.actionId)),
    )
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "ru");
      if (a.price === null) return b.price === null ? 0 : 1;
      if (b.price === null) return -1;
      return sort === "price-asc" ? a.price - b.price : b.price - a.price;
    });
  const count =
    cart.cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const quantity = (id: string) =>
    cart.cart?.items
      .filter((item) => item.productId === id)
      .reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const actionsDisabled =
    cart.busy || cart.loading || Boolean(cart.error) || !cart.cart;
  const filtersCount = Number(hasPriceFilter) + Number(promotionOnly);

  function resetFilters() {
    setMinPrice(0);
    setMaxPrice(null);
    setPromotionOnly(false);
  }

  function navigate(nextTrail: Category[]) {
    setTrail(nextTrail);
    setSearch("");
    setQuery("");
    resetFilters();
  }

  function updateSearch(value: string) {
    setSearch(value);
    resetFilters();
  }

  async function add(product: Product) {
    if (await cart.add(product.id)) setAnnouncement("Корзина обновлена");
  }

  function renderFilters() {
    return (
      <>
        <div className="filter-heading">
          <h3>Фильтры</h3>
          <button
            className="text-button"
            disabled={!filtersCount}
            onClick={resetFilters}
          >
            Сбросить
          </button>
        </div>
        <fieldset className="filter-section">
          <legend>Категории</legend>
          <div className="category-options">
            <button
              className={`category-option ${!trail.length && !query ? "is-active" : ""}`}
              onClick={() => navigate([])}
            >
              <Icon name="grid" size={18} />
              <span>Все категории</span>
            </button>
            {trail.length > 0 && (
              <button
                className="category-option"
                onClick={() => navigate(trail.slice(0, -1))}
              >
                <Icon name="return" size={18} />
                <span>На уровень выше</span>
              </button>
            )}
            {categories.map((category) => (
              <button
                key={category.id}
                className="category-option"
                onClick={() => navigate([...trail, category])}
              >
                <Icon name="grid" size={18} />
                <span>{category.name}</span>
                <Icon name="chevron" size={12} />
              </button>
            ))}
          </div>
        </fieldset>
        {products.length > 0 && (
          <>
            <PriceFilter
              min={priceMin}
              max={priceMax}
              limit={priceLimit}
              onChange={(min, max) => {
                setMinPrice(min);
                setMaxPrice(max === priceLimit ? null : max);
              }}
            />
            <fieldset className="filter-section special-filter">
              <legend>Подборка</legend>
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={promotionOnly}
                  onChange={(event) => setPromotionOnly(event.target.checked)}
                />
                <span>Участвует в акции</span>
                <span className="tiny-label">%</span>
              </label>
            </fieldset>
            <p className="filter-explanation">
              Цена и сортировка применяются к товарам текущей подборки.
            </p>
          </>
        )}
      </>
    );
  }

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
            className="brand-button"
            aria-label="NEW STYLE — каталог"
            onClick={() => navigate([])}
          >
            <Brand />
          </button>
          <nav className="desktop-nav" aria-label="Основная навигация">
            <button className="is-active" onClick={() => navigate([])}>
              Каталог
            </button>
          </nav>
          <div className="header-actions">
            <button className="cart-trigger" onClick={() => setCartOpen(true)}>
              <Icon name="bag" size={20} />
              <span>Корзина</span>
              <span className="cart-count">{cart.loading ? "…" : count}</span>
            </button>
            <button
              className="text-button logout-button"
              onClick={onLogout}
              disabled={cart.busy}
            >
              Выйти
            </button>
          </div>
        </div>
      </header>
      <main className="page-shell">
        <section className="catalog-intro">
          <span className="eyebrow">ВАШ АССОРТИМЕНТ</span>
          <h1>
            Товары для
            <br />
            <span>вашего дела.</span>
          </h1>
          <p>Выберите категорию или найдите нужный товар по названию.</p>
        </section>
        <nav className="catalog-breadcrumb" aria-label="Путь в каталоге">
          <button onClick={() => navigate([])}>Каталог</button>
          {trail.map((category, index) => (
            <span className="breadcrumb-part" key={category.id}>
              <Icon name="chevron" size={12} />
              <button onClick={() => navigate(trail.slice(0, index + 1))}>
                {category.name}
              </button>
            </span>
          ))}
          {query && (
            <span className="breadcrumb-part">
              <Icon name="chevron" size={12} />
              <span>Поиск по всему каталогу</span>
            </span>
          )}
        </nav>
        <section
          id="catalog"
          className="catalog"
          aria-labelledby="catalog-title"
        >
          <div className="catalog-heading">
            <div className="catalog-title-row">
              <h2 id="catalog-title">
                {query
                  ? "Результаты поиска"
                  : (trail.at(-1)?.name ?? "Каталог товаров")}
                <span className="title-period">.</span>
              </h2>
              {data && <span className="total-count">{products.length}</span>}
            </div>
          </div>
          <div className="catalog-layout">
            <aside className="filter-sidebar" aria-label="Фильтры товаров">
              {renderFilters()}
            </aside>
            <div className="catalog-results">
              <div className="catalog-toolbar">
                <label className="search-field">
                  <Icon name="search" size={19} />
                  <input
                    type="search"
                    placeholder="Название товара"
                    aria-label="Поиск по всему каталогу"
                    value={search}
                    onChange={(event) => updateSearch(event.target.value)}
                  />
                  {search && (
                    <button
                      aria-label="Очистить поиск"
                      onClick={() => updateSearch("")}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </label>
                <label className="sort-field">
                  <span className="sr-only">Сортировка</span>
                  <Icon name="sliders" size={16} />
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as Sort)}
                  >
                    <option value="name">По названию</option>
                    <option value="price-asc">Сначала дешевле</option>
                    <option value="price-desc">Сначала дороже</option>
                  </select>
                </label>
              </div>
              <div className="results-meta">
                <p aria-live="polite">
                  {loading
                    ? "Загружаем каталог…"
                    : data
                      ? `Товаров: ${visibleProducts.length}`
                      : "Не удалось загрузить каталог"}
                </p>
                <button
                  className="mobile-filter-button"
                  onClick={() => filterDialog.current?.showModal()}
                >
                  <Icon name="sliders" size={16} />
                  Фильтры{filtersCount > 0 && <span>{filtersCount}</span>}
                </button>
              </div>
              {cart.error && (
                <div className="inline-status" role="alert">
                  <p>Корзина: {cart.error}</p>
                  <button
                    className="text-button"
                    onClick={() => void cart.reload()}
                    disabled={cart.loading || cart.busy}
                  >
                    Обновить корзину
                  </button>
                </div>
              )}
              <div aria-busy={loading}>
                {loading ? (
                  <div className="catalog-loading" role="status">
                    <span className="loading-spinner" />
                    Загружаем товары и категории…
                  </div>
                ) : error ? (
                  <div className="empty-results" role="alert">
                    <Icon name="return" size={32} />
                    <h3>
                      {invalidQuery ? "Уточните запрос" : "Каталог недоступен"}
                    </h3>
                    <p>{error}</p>
                    <button
                      className="primary-button"
                      onClick={() => setAttempt((current) => current + 1)}
                    >
                      Повторить запрос
                    </button>
                  </div>
                ) : (
                  <>
                    {categories.length > 0 && (
                      <div
                        className="category-grid"
                        aria-label="Разделы каталога"
                      >
                        {categories.map((category) => (
                          <button
                            key={category.id}
                            className="category-tile"
                            onClick={() => navigate([...trail, category])}
                          >
                            <Icon name="grid" size={23} />
                            <span>{category.name}</span>
                            <Icon name="arrow-up-right" size={17} />
                          </button>
                        ))}
                      </div>
                    )}
                    {visibleProducts.length > 0 ? (
                      <div className="product-grid">
                        {visibleProducts.map((product, index) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            index={index}
                            quantity={quantity(product.id)}
                            busy={actionsDisabled}
                            onOpen={(item) => setSelectedId(item.id)}
                            onAdd={(item) => void add(item)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="empty-results">
                        <Icon
                          name={categories.length ? "grid" : "search"}
                          size={32}
                        />
                        <h3>
                          {categories.length
                            ? "Выберите раздел"
                            : filtersCount
                              ? "Нет товаров по этим фильтрам"
                              : query
                                ? "Ничего не найдено"
                                : "В этом разделе пока нет товаров"}
                        </h3>
                        <p>
                          {categories.length
                            ? "Откройте категорию, чтобы увидеть её товары."
                            : query
                              ? "Попробуйте изменить поисковый запрос."
                              : "Попробуйте другую категорию или измените фильтры."}
                        </p>
                        {filtersCount > 0 && (
                          <button
                            className="primary-button"
                            onClick={resetFilters}
                          >
                            Сбросить фильтры
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <button
            className="brand-button footer-brand"
            onClick={() => navigate([])}
            aria-label="NEW STYLE — каталог"
          >
            <Brand />
          </button>
          <span>
            {isDemoMode
              ? "Деморежим · тестовые данные"
              : "Каталог для вашего бизнеса"}
          </span>
          <span className="footer-copyright">
            © {new Date().getFullYear()} NEW STYLE
          </span>
        </div>
      </footer>
      <div
        className={`toast ${announcement ? "is-visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        <Icon name="check" size={16} />
        {announcement}
      </div>
      <CartDrawer
        open={cartOpen}
        cart={cart.cart}
        loading={cart.loading}
        busy={cart.busy}
        error={cart.error}
        onClose={() => setCartOpen(false)}
        onRetry={() => void cart.reload()}
        onAdd={(id) => void cart.add(id)}
        onMinus={(id) => void cart.minus(id)}
        onRemove={(id) => void cart.remove(id)}
        onClear={() => void cart.clear()}
      />
      <ProductDialog
        cartError={cart.error}
        cartRetrying={cart.loading || cart.busy}
        onCartRetry={() => void cart.reload()}
        productId={selectedId}
        token={session.token}
        quantity={selectedId ? quantity(selectedId) : 0}
        busy={actionsDisabled}
        onClose={() => setSelectedId(null)}
        onAdd={(product) => void add(product)}
        onOpen={(product) => setSelectedId(product.id)}
      />
      <dialog
        className="filter-dialog"
        ref={filterDialog}
        aria-label="Фильтры товаров"
        onClick={(event) => {
          if (event.target === event.currentTarget)
            filterDialog.current?.close();
        }}
      >
        <div className="filter-dialog-content">
          <div className="mobile-dialog-heading">
            <span>Ваша подборка</span>
            <button
              className="icon-button"
              aria-label="Закрыть фильтры"
              onClick={() => filterDialog.current?.close()}
            >
              <Icon name="close" />
            </button>
          </div>
          {renderFilters()}
          <button
            className="primary-button apply-filters"
            onClick={() => filterDialog.current?.close()}
          >
            Показать товары
            <Icon name="arrow" size={18} />
          </button>
        </div>
      </dialog>
    </>
  );
}

export default function App() {
  // The API token contains a password hash: never persist it in localStorage.
  const [session, setSession] = useState<Session | null>(null);
  return session ? (
    <Shop
      key={session.token}
      session={session}
      onLogout={() => setSession(null)}
    />
  ) : (
    <Login onLogin={setSession} />
  );
}
