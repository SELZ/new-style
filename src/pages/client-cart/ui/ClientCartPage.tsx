import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Modal,
  Select,
  Textarea,
  TextInput,
} from "@mantine/core";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import {
  money,
  store,
  useWholesale,
} from "../../../entities/wholesale/index.ts";
import type { StockProduct } from "../../../entities/wholesale/index.ts";
import "./client-cart.css";

type Priority = "normal" | "urgent" | "vip";
const priorityLabels: Record<Priority, string> = {
  normal: "Обычный",
  urgent: "Срочный",
  vip: "VIP",
};

export default function ClientCartPage() {
  const { state, user } = useWholesale();
  const navigate = useNavigate();
  const [address, setAddress] = useState(user?.address ?? "");
  const [comment, setComment] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const cart = user ? (state.carts[user.id] ?? {}) : {};
  const entries = Object.entries(cart)
    .map(([id, quantity]) => {
      const product = state.products.find((item) => item.id === id);
      return product ? { product, quantity } : null;
    })
    .filter(
      (item): item is { product: StockProduct; quantity: number } =>
        item !== null,
    );
  const invalid = entries.find(
    ({ product, quantity }) =>
      !product.available || quantity > product.stock || quantity < 1,
  );
  const missingProducts = entries.length !== Object.keys(cart).length;
  const groups = state.warehouses
    .map((warehouse) => ({
      warehouse,
      items: entries.filter(
        ({ product }) => product.warehouseId === warehouse.id,
      ),
    }))
    .filter((group) => group.items.length > 0);
  const total = entries.reduce(
    (sum, { product, quantity }) => sum + product.price * quantity,
    0,
  );
  const quantity = entries.reduce((sum, item) => sum + item.quantity, 0);

  function updateQuantity(product: StockProduct, next: number) {
    setError("");
    try {
      store.setCartItem(product.id, next);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось изменить корзину.",
      );
    }
  }

  function review() {
    setError("");
    if (!address.trim()) {
      setError("Укажите адрес доставки.");
      return;
    }
    if (missingProducts) {
      setError("Часть товаров больше недоступна. Обновите состав корзины.");
      return;
    }
    if (invalid) {
      setError(
        `Проверьте количество и доступность товара «${invalid.product.name}».`,
      );
      return;
    }
    setReviewOpen(true);
  }

  async function checkout() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const order = await store.checkout({
        address: address.trim(),
        comment: comment.trim(),
        priority,
      });
      navigate(`/orders/${order.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось оформить заказ.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  if (!entries.length && !missingProducts)
    return (
      <div className="client-cart-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">ВАШ ЗАКАЗ</span>
            <h1>Корзина</h1>
            <p>Здесь будут товары, которые вы выберете для магазина.</p>
          </div>
        </div>
        <div className="empty-state client-cart-empty">
          <div className="client-cart-empty-icon">
            <ShoppingCart size={44} strokeWidth={1.5} />
          </div>
          <h2>Пока ничего не добавлено</h2>
          <p>
            Откройте каталог и соберите первый заказ.
            <br />
            Товары с разных складов можно оформить вместе.
          </p>
          <Button
            component={Link}
            to="/catalog"
            rightSection={<ArrowRight size={17} />}
          >
            Перейти в каталог
          </Button>
        </div>
      </div>
    );

  return (
    <div className="client-cart-page">
      <div className="page-heading client-cart-heading">
        <div>
          <span className="eyebrow">ВАШ ЗАКАЗ</span>
          <h1>
            Корзина <span>{entries.length}</span>
          </h1>
          <p>Проверьте товары и укажите детали доставки.</p>
        </div>
        <Button
          component={Link}
          to="/catalog"
          variant="subtle"
          leftSection={<ArrowLeft size={16} />}
        >
          Продолжить покупки
        </Button>
      </div>
      {error && (
        <Alert color="red" mb="md" withCloseButton onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {(invalid || missingProducts) && (
        <Alert color="orange" mb="md">
          Некоторые товары недоступны в выбранном количестве. Исправьте корзину
          перед оформлением.
        </Alert>
      )}
      <div className="client-cart-layout">
        <div className="client-cart-main">
          {groups.map(({ warehouse, items }) => (
            <section className="client-cart-warehouse" key={warehouse.id}>
              <div className="client-cart-warehouse-heading">
                <span className="client-cart-warehouse-icon">
                  <WarehouseIcon size={20} />
                </span>
                <div>
                  <h2>{warehouse.name}</h2>
                  <p>Позиций: {items.length}</p>
                </div>
                <Badge variant="light" color="gray">
                  Отдельная сборка
                </Badge>
              </div>
              {items.map(({ product, quantity: count }) => (
                <article className="client-cart-line" key={product.id}>
                  <div className="client-cart-product-icon">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt=""
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <Package size={25} />
                    )}
                  </div>
                  <div className="client-cart-product-name">
                    <span>{product.category}</span>
                    <h3>{product.name}</h3>
                    <p>
                      {money(product.price)} / {product.unit}
                    </p>
                    {(!product.available || count > product.stock) && (
                      <strong className="client-cart-stock-error">
                        {product.available
                          ? `Доступно только ${product.stock} ${product.unit}`
                          : "Товар недоступен"}
                      </strong>
                    )}
                  </div>
                  <div
                    className="client-cart-quantity"
                    role="group"
                    aria-label={`Количество: ${product.name}`}
                  >
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={`Уменьшить количество: ${product.name}`}
                      onClick={() => updateQuantity(product, count - 1)}
                      disabled={busy}
                    >
                      <Minus size={15} />
                    </ActionIcon>
                    <span>{count}</span>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={`Увеличить количество: ${product.name}`}
                      onClick={() => updateQuantity(product, count + 1)}
                      disabled={
                        busy || !product.available || count >= product.stock
                      }
                    >
                      <Plus size={15} />
                    </ActionIcon>
                  </div>
                  <strong className="client-cart-line-total">
                    {money(product.price * count)}
                  </strong>
                  <ActionIcon
                    className="client-cart-remove"
                    variant="subtle"
                    color="gray"
                    aria-label={`Удалить: ${product.name}`}
                    onClick={() => updateQuantity(product, 0)}
                    disabled={busy}
                  >
                    <Trash2 size={17} />
                  </ActionIcon>
                </article>
              ))}
              <div className="client-cart-warehouse-total">
                <span>Итого по складу</span>
                <strong>
                  {money(
                    items.reduce(
                      (sum, item) => sum + item.product.price * item.quantity,
                      0,
                    ),
                  )}
                </strong>
              </div>
            </section>
          ))}
          <section className="client-cart-delivery">
            <div className="client-cart-section-title">
              <MapPin size={20} />
              <div>
                <h2>Детали заказа</h2>
                <p>Эти данные увидят сотрудники склада.</p>
              </div>
            </div>
            <TextInput
              label="Адрес доставки"
              placeholder="Город, улица, дом, помещение"
              value={address}
              onChange={(event) => setAddress(event.currentTarget.value)}
              required
              disabled={busy}
            />
            <Select
              label="Приоритет заказа"
              value={priority}
              onChange={(value) => setPriority((value ?? "normal") as Priority)}
              data={Object.entries(priorityLabels).map(([value, label]) => ({
                value,
                label,
              }))}
              disabled={busy}
            />
            <Textarea
              label="Комментарий"
              placeholder="Время доставки, контактное лицо или пожелания к заказу"
              value={comment}
              onChange={(event) => setComment(event.currentTarget.value)}
              minRows={3}
              maxLength={1000}
              disabled={busy}
            />
          </section>
        </div>
        <aside className="client-cart-summary" aria-label="Сумма заказа">
          <span className="eyebrow">ВАШ ЗАКАЗ</span>
          <h2>Итог заказа</h2>
          <dl>
            <div>
              <dt>Товарных позиций</dt>
              <dd>{entries.length}</dd>
            </div>
            <div>
              <dt>Количество единиц</dt>
              <dd>{quantity}</dd>
            </div>
            <div>
              <dt>Складов</dt>
              <dd>{groups.length}</dd>
            </div>
          </dl>
          <div className="client-cart-total">
            <span>К оплате</span>
            <strong>{money(total)}</strong>
          </div>
          <Button
            fullWidth
            size="md"
            rightSection={<ArrowRight size={18} />}
            onClick={review}
            disabled={busy || Boolean(invalid) || missingProducts}
          >
            Проверить заказ
          </Button>
          <p className="client-cart-confirm-note">
            <ShieldCheck size={16} />
            Перед оформлением вы сможете проверить все данные.
          </p>
          <div className="client-cart-process">
            <span>
              <Check size={14} />
              Проверим остатки при оформлении
            </span>
            <span>
              <Check size={14} />
              Распределим товары по складам
            </span>
          </div>
        </aside>
      </div>
      <Modal
        opened={reviewOpen}
        onClose={() => {
          if (!busy) setReviewOpen(false);
        }}
        title="Проверьте заказ"
        centered
        size="lg"
        closeOnClickOutside={!busy}
        closeOnEscape={!busy}
        withCloseButton={!busy}
      >
        <div className="client-cart-review">
          <p className="muted">
            После подтверждения товары будут зарезервированы для вашего заказа.
          </p>
          {error && <Alert color="red">{error}</Alert>}
          {groups.map(({ warehouse, items }) => (
            <div className="client-cart-review-group" key={warehouse.id}>
              <h3>
                <WarehouseIcon size={16} />
                {warehouse.name}
              </h3>
              {items.map(({ product, quantity: count }) => (
                <div className="client-cart-review-item" key={product.id}>
                  <span>
                    {product.name}
                    <small>
                      {count} {product.unit} × {money(product.price)}
                    </small>
                  </span>
                  <strong>{money(product.price * count)}</strong>
                </div>
              ))}
            </div>
          ))}
          <dl className="client-cart-review-details">
            <div>
              <dt>Адрес</dt>
              <dd>{address}</dd>
            </div>
            <div>
              <dt>Приоритет</dt>
              <dd>{priorityLabels[priority]}</dd>
            </div>
            {comment && (
              <div>
                <dt>Комментарий</dt>
                <dd>{comment}</dd>
              </div>
            )}
          </dl>
          <div className="client-cart-total">
            <span>Итого</span>
            <strong>{money(total)}</strong>
          </div>
          <Button
            fullWidth
            size="md"
            onClick={() => void checkout()}
            loading={busy}
            leftSection={<Check size={18} />}
          >
            Подтвердить и оформить
          </Button>
          <Button
            fullWidth
            variant="subtle"
            onClick={() => setReviewOpen(false)}
            disabled={busy}
          >
            Вернуться к корзине
          </Button>
        </div>
      </Modal>
    </div>
  );
}
