import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { Cart } from "../api/types";
import Icon from "./Icon";
import ProductImage from "./ProductImage";
import "./CartDrawer.css";
import "./BackendComponents.css";

interface CartDrawerProps {
  open: boolean;
  cart: Cart | null;
  loading: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onRetry: () => void;
  onAdd: (id: string) => void;
  onMinus: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

export default function CartDrawer({
  open,
  cart,
  loading,
  busy,
  error,
  onClose,
  onRetry,
  onAdd,
  onMinus,
  onRemove,
  onClear,
}: CartDrawerProps) {
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const items = cart?.items ?? [];
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const disabled = loading || busy || Boolean(error);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const backgroundElements = Array.from(document.body.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element !== overlayRef.current,
      )
      .map((element) => ({ element, wasInert: element.inert }));
    backgroundElements.forEach(({ element }) => {
      element.inert = true;
    });
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleFocus = (event: FocusEvent) => {
      if (
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target)
      ) {
        closeButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocus);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocus);
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach(({ element, wasInert }) => {
        element.inert = wasInert;
      });
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="cart-overlay"
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="cart-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="cart-header">
          <div>
            <p className="cart-eyebrow">ВАШ ВЫБОР</p>
            <h2 id={titleId}>
              Корзина
              {cart && <span className="cart-count">{count}</span>}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            className="cart-icon-button cart-close"
            type="button"
            onClick={onClose}
            aria-label="Закрыть корзину"
          >
            <Icon name="close" />
          </button>
        </header>

        {(loading || busy) && (
          <p className="backend-cart-status" role="status">
            {busy ? "Обновляем корзину…" : "Загружаем корзину…"}
          </p>
        )}
        {error && (
          <div className="backend-cart-error" role="alert">
            <p>{error}</p>
            <button
              className="backend-retry-button"
              type="button"
              disabled={loading || busy}
              onClick={onRetry}
            >
              Повторить загрузку
            </button>
          </div>
        )}

        {cart && items.length > 0 ? (
          <>
            <div className="cart-items" aria-busy={loading || busy}>
              {items.map((item) => (
                <article className="cart-item" key={item.key}>
                  <div className="cart-item-image">
                    <ProductImage product={item} />
                  </div>
                  <div className="cart-item-info">
                    <p className="cart-item-category">
                      {item.actionId ? "Акция" : "Товар"}
                      {item.unit && ` · ${item.unit}`}
                    </p>
                    <h3>{item.name}</h3>
                    <p className="cart-item-price">
                      {currency.format(item.lineTotal)}
                      <span className="backend-cart-line-label">
                        {" "}
                        за позицию
                      </span>
                    </p>
                    <div className="cart-item-actions">
                      <div
                        className="cart-quantity"
                        role="group"
                        aria-label={`Количество: ${item.name}`}
                      >
                        <button
                          type="button"
                          disabled={disabled}
                          aria-label={`Уменьшить количество ${item.name}`}
                          onClick={() => onMinus(item.productId)}
                        >
                          <Icon name="minus" size={16} />
                        </button>
                        <span aria-live="polite" aria-atomic="true">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={disabled}
                          aria-label={`Увеличить количество ${item.name}`}
                          onClick={() => onAdd(item.productId)}
                        >
                          <Icon name="plus" size={16} />
                        </button>
                      </div>
                      <button
                        className="cart-remove"
                        type="button"
                        disabled={disabled}
                        aria-label={`Удалить ${item.name} из корзины`}
                        onClick={(event) => {
                          const row = event.currentTarget.closest(".cart-item");
                          const nextFocus =
                            row?.nextElementSibling?.querySelector<HTMLButtonElement>(
                              ".cart-remove",
                            ) ??
                            row?.previousElementSibling?.querySelector<HTMLButtonElement>(
                              ".cart-remove",
                            ) ??
                            closeButtonRef.current;
                          nextFocus?.focus();
                          onRemove(item.productId);
                        }}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <footer className="cart-footer">
              <div className="cart-summary">
                <span>Количество: {count}</span>
                <button
                  type="button"
                  className="cart-remove"
                  disabled={disabled}
                  onClick={onClear}
                >
                  Очистить корзину
                </button>
              </div>
              {cart.bonus !== null && cart.bonus > 0 && (
                <div className="cart-summary">
                  <span>Бонусы</span>
                  <span>{cart.bonus}</span>
                </div>
              )}
              <div className="cart-total" aria-live="polite" aria-atomic="true">
                <span>Итого</span>
                <strong>{currency.format(cart.amount)}</strong>
              </div>
              <button
                className="cart-checkout"
                type="button"
                disabled
                aria-describedby={`${titleId}-checkout-note`}
              >
                Оформить заказ
                <Icon name="arrow" />
              </button>
              <p className="cart-checkout-note" id={`${titleId}-checkout-note`}>
                Оформление заказа пока недоступно.
              </p>
            </footer>
          </>
        ) : cart && !loading && !error ? (
          <div className="cart-empty">
            <div className="cart-empty-icon">
              <Icon name="bag" size={43} />
            </div>
            <h3>Здесь пока пусто</h3>
            <p>Добавьте товары из каталога.</p>
            <button className="cart-browse" type="button" onClick={onClose}>
              Продолжить покупки
              <Icon name="arrow" />
            </button>
          </div>
        ) : (
          <div className="backend-cart-space" />
        )}
      </section>
    </div>,
    document.body,
  );
}
