import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Modal,
  NumberInput,
  Select,
  Switch,
  TextInput,
} from "@mantine/core";
import {
  ArrowRight,
  Check,
  MapPin,
  Package,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Warehouse as WarehouseIcon,
  X,
} from "lucide-react";
import {
  money,
  store,
  useWholesale,
} from "../../../entities/wholesale/index.ts";
import type { StockProduct } from "../../../entities/wholesale/index.ts";
import "./storefront.css";

type Quantity = number | string;

function ProductPhoto({
  product,
  large = false,
}: {
  product: StockProduct;
  large?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState("");
  return (
    <div
      className={`storefront-photo${large ? " storefront-photo-large" : ""}`}
    >
      {product.image && failedUrl !== product.image ? (
        <img
          src={product.image}
          alt={product.name}
          loading={large ? "eager" : "lazy"}
          onError={() => setFailedUrl(product.image)}
        />
      ) : (
        <div className="storefront-photo-fallback">
          <Package size={large ? 74 : 52} strokeWidth={1.2} />
          <span>{product.category}</span>
        </div>
      )}
    </div>
  );
}

export default function StorefrontPage() {
  const { state, user } = useWholesale();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState("name");
  const [quantities, setQuantities] = useState<Record<string, Quantity>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [addedName, setAddedName] = useState("");
  const cart = user ? (state.carts[user.id] ?? {}) : {};
  const categories = [
    ...new Set(state.products.map((product) => product.category)),
  ].sort((a, b) => a.localeCompare(b, "ru"));
  const query = search.trim().toLocaleLowerCase("ru");
  const products = state.products
    .filter(
      (product) =>
        (!query ||
          `${product.name} ${product.category}`
            .toLocaleLowerCase("ru")
            .includes(query)) &&
        (!category || product.category === category) &&
        (!warehouseId || product.warehouseId === warehouseId) &&
        (!availableOnly || (product.available && product.stock > 0)),
    )
    .sort((a, b) =>
      sort === "price-asc"
        ? a.price - b.price
        : sort === "price-desc"
          ? b.price - a.price
          : a.name.localeCompare(b.name, "ru"),
    );
  const selected = state.products.find((product) => product.id === selectedId);
  const warehouseName = (id: string) =>
    state.warehouses.find((warehouse) => warehouse.id === id)?.name ?? "Склад";
  const hasFilters = Boolean(query || category || warehouseId || availableOnly);
  const cartCount = Object.values(cart).reduce(
    (sum, quantity) => sum + quantity,
    0,
  );

  function resetFilters() {
    setSearch("");
    setCategory("");
    setWarehouseId("");
    setAvailableOnly(false);
  }

  function addProduct(product: StockProduct) {
    const quantity = Number(quantities[product.id] ?? 1);
    setError("");
    setAddedName("");
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      setError("Укажите целое количество от 1.");
      return;
    }
    try {
      store.setCartItem(product.id, (cart[product.id] ?? 0) + quantity);
      setAddedName(product.name);
      setQuantities((current) => ({ ...current, [product.id]: 1 }));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось добавить товар.",
      );
    }
  }

  function renderAdd(product: StockProduct) {
    const inCart = cart[product.id] ?? 0;
    const remaining = Math.max(0, product.stock - inCart);
    const unavailable = !product.available || remaining === 0;
    return (
      <div className="storefront-add-block">
        <div className="storefront-add-controls">
          <NumberInput
            aria-label={`Количество: ${product.name}`}
            value={quantities[product.id] ?? 1}
            min={1}
            max={Math.max(1, remaining)}
            allowDecimal={false}
            allowNegative={false}
            onChange={(value) =>
              setQuantities((current) => ({ ...current, [product.id]: value }))
            }
            disabled={unavailable}
            className="storefront-quantity"
            size="sm"
          />
          <Button
            leftSection={<ShoppingCart size={16} />}
            onClick={() => addProduct(product)}
            disabled={unavailable}
            size="sm"
          >
            {unavailable
              ? inCart > 0
                ? "Всё в корзине"
                : "Нет в наличии"
              : "В корзину"}
          </Button>
        </div>
        {inCart > 0 && (
          <span className="storefront-in-cart">
            <Check size={13} />В корзине: {inCart} {product.unit}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="storefront-page">
      <div className="page-heading storefront-heading">
        <div>
          <span className="eyebrow">ЗАКУПКИ ДЛЯ ВАШЕГО МАГАЗИНА</span>
          <h1>Каталог товаров</h1>
          <p>Весь ассортимент, актуальные цены и остатки по складам.</p>
        </div>
        <Button
          component={Link}
          to="/cart"
          variant="light"
          leftSection={<ShoppingCart size={18} />}
        >
          Корзина{cartCount > 0 ? ` · ${cartCount}` : ""}
        </Button>
      </div>
      <div className="storefront-banner">
        <div>
          <span>ВСЁ ПОД РУКОЙ</span>
          <h2>
            Ваш следующий заказ
            <br />
            начинается здесь.
          </h2>
          <p>Соберите товары с нужных складов в одну корзину.</p>
        </div>
        <div className="storefront-banner-art" aria-hidden="true">
          <Package size={70} strokeWidth={1} />
          <span>
            <WarehouseIcon size={24} />
            {state.warehouses.length} склада
          </span>
        </div>
      </div>
      <div className="storefront-layout">
        <aside className="storefront-sidebar" aria-label="Категории товаров">
          <div className="storefront-sidebar-heading">
            <h2>Категории</h2>
            <SlidersHorizontal size={16} />
          </div>
          <button
            className={`storefront-category ${category === "" ? "is-active" : ""}`}
            onClick={() => setCategory("")}
          >
            <span>Все товары</span>
            <span>{state.products.length}</span>
          </button>
          {categories.map((item) => (
            <button
              key={item}
              className={`storefront-category ${category === item ? "is-active" : ""}`}
              onClick={() => setCategory(item)}
            >
              <span>{item}</span>
              <span>
                {
                  state.products.filter((product) => product.category === item)
                    .length
                }
              </span>
            </button>
          ))}
          <div className="storefront-warehouse-note">
            <WarehouseIcon size={22} />
            <strong>Несколько складов — один заказ</strong>
            <p>Мы распределим позиции по складам при оформлении.</p>
          </div>
        </aside>
        <section className="storefront-results" aria-label="Товары">
          <div className="storefront-filters">
            <TextInput
              placeholder="Найти товар или категорию"
              aria-label="Поиск товаров"
              leftSection={<Search size={17} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              rightSection={
                search ? (
                  <button
                    className="storefront-clear-search"
                    aria-label="Очистить поиск"
                    onClick={() => setSearch("")}
                  >
                    <X size={14} />
                  </button>
                ) : undefined
              }
            />
            <Select
              aria-label="Склад"
              placeholder="Все склады"
              value={warehouseId || null}
              clearable
              data={state.warehouses.map((warehouse) => ({
                value: warehouse.id,
                label: warehouse.name,
              }))}
              onChange={(value) => setWarehouseId(value ?? "")}
              leftSection={<WarehouseIcon size={16} />}
            />
          </div>
          <div className="storefront-result-meta">
            <span>
              Найдено товаров: <strong>{products.length}</strong>
            </span>
            <Switch
              label="Только в наличии"
              checked={availableOnly}
              onChange={(event) =>
                setAvailableOnly(event.currentTarget.checked)
              }
              size="xs"
            />
            <Select
              aria-label="Сортировка товаров"
              value={sort}
              onChange={(value) => setSort(value ?? "name")}
              data={[
                { value: "name", label: "По названию" },
                { value: "price-asc", label: "Сначала дешевле" },
                { value: "price-desc", label: "Сначала дороже" },
              ]}
              size="xs"
              className="storefront-sort"
            />
          </div>
          {hasFilters && (
            <div className="storefront-active-filters">
              {category && <Badge variant="light">{category}</Badge>}
              {warehouseId && (
                <Badge variant="light" color="gray">
                  {warehouseName(warehouseId)}
                </Badge>
              )}
              <button onClick={resetFilters}>
                Сбросить фильтры <X size={13} />
              </button>
            </div>
          )}
          {error && (
            <Alert
              color="red"
              withCloseButton
              onClose={() => setError("")}
              mb="md"
            >
              {error}
            </Alert>
          )}
          {addedName && (
            <Alert
              color="teal"
              withCloseButton
              onClose={() => setAddedName("")}
              mb="md"
              icon={<Check size={17} />}
            >
              {addedName} — в корзине. <Link to="/cart">Перейти к заказу</Link>
            </Alert>
          )}
          {products.length ? (
            <div className="storefront-grid">
              {products.map((product) => (
                <article className="storefront-product" key={product.id}>
                  <button
                    className="storefront-photo-button"
                    aria-label={`Подробнее: ${product.name}`}
                    onClick={() => setSelectedId(product.id)}
                  >
                    <ProductPhoto product={product} />
                    <span
                      className={`storefront-stock-badge ${product.available && product.stock > 0 ? "" : "is-unavailable"}`}
                    >
                      {product.available && product.stock > 0
                        ? "В наличии"
                        : "Недоступен"}
                    </span>
                  </button>
                  <div className="storefront-product-body">
                    <span className="storefront-product-category">
                      {product.category}
                    </span>
                    <button
                      className="storefront-product-title"
                      onClick={() => setSelectedId(product.id)}
                    >
                      {product.name}
                    </button>
                    <div className="storefront-product-location">
                      <WarehouseIcon size={13} />
                      <span>{warehouseName(product.warehouseId)}</span>
                    </div>
                    <p className="storefront-stock">
                      Остаток: {product.stock} {product.unit} ·{" "}
                      {product.location.rack}/{product.location.shelf}
                    </p>
                    <div className="storefront-price">
                      {money(product.price)}
                      <span> / {product.unit}</span>
                    </div>
                    {renderAdd(product)}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state storefront-empty">
              <Search size={38} />
              <h2>Товары не найдены</h2>
              <p>Измените запрос или выберите другой склад.</p>
              <Button variant="light" onClick={resetFilters}>
                Сбросить фильтры
              </Button>
            </div>
          )}
        </section>
      </div>
      <Modal
        opened={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title="О товаре"
        centered
        size="lg"
      >
        {selected && (
          <div className="storefront-detail">
            <ProductPhoto product={selected} large />
            <div className="storefront-detail-body">
              <Badge variant="light">{selected.category}</Badge>
              <h2>{selected.name}</h2>
              <div className="storefront-detail-facts">
                <div>
                  <WarehouseIcon size={16} />
                  <span>Склад</span>
                  <strong>{warehouseName(selected.warehouseId)}</strong>
                </div>
                <div>
                  <MapPin size={16} />
                  <span>Место хранения</span>
                  <strong>
                    Стеллаж {selected.location.rack}, полка{" "}
                    {selected.location.shelf}
                  </strong>
                </div>
                <div>
                  <Package size={16} />
                  <span>Доступный остаток</span>
                  <strong>
                    {selected.stock} {selected.unit}
                  </strong>
                </div>
              </div>
              <div className="storefront-price">
                {money(selected.price)}
                <span> / {selected.unit}</span>
              </div>
              {error && (
                <Alert color="red" my="sm">
                  {error}
                </Alert>
              )}
              {renderAdd(selected)}
              <Button
                component={Link}
                to="/cart"
                variant="subtle"
                rightSection={<ArrowRight size={16} />}
                mt="sm"
              >
                Открыть корзину
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
