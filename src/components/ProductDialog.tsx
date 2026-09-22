import { useEffect, useId, useMemo, useRef, useState } from "react";
import { api, getErrorMessage } from "../api/client";
import type { Product, ProductDetail } from "../api/types";
import Icon from "./Icon";
import ProductImage from "./ProductImage";
import "./BackendComponents.css";

type ProductDialogProps = {
  productId: string | null;
  token: string;
  quantity: number;
  busy: boolean;
  cartError: string;
  cartRetrying: boolean;
  onCartRetry: () => void;
  onClose: () => void;
  onAdd: (product: Product) => void;
  onOpen: (product: Product) => void;
};

type DetailState = {
  request: { productId: string | null; token: string; attempt: number };
  data: ProductDetail | null;
  error: string;
};

const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

export default function ProductDialog({
  productId,
  token,
  quantity,
  busy,
  cartError,
  cartRetrying,
  onCartRetry,
  onClose,
  onAdd,
  onOpen,
}: ProductDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [attempt, setAttempt] = useState(0);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [promotion, setPromotion] = useState<DetailState | null>(null);
  const [promotionAttempt, setPromotionAttempt] = useState(0);
  const [selectedImage, setSelectedImage] = useState({
    productId: "",
    url: "",
  });
  const request = useMemo(
    () => ({ productId, token, attempt }),
    [productId, token, attempt],
  );
  const isOpen = productId !== null;
  const current = detail?.request === request ? detail : null;
  const product = current?.data?.product;
  const promotionId = product?.actionId ? product.id : null;
  const promotionRequest = useMemo(
    () => ({ ...request, attempt: promotionAttempt }),
    [request, promotionAttempt],
  );
  const currentPromotion =
    promotion?.request === promotionRequest ? promotion : null;
  const loading = !current;
  const images = current?.data?.images ?? [];
  const activeImage =
    selectedImage.productId === productId &&
    images.some((image) => image.url === selectedImage.url)
      ? selectedImage.url
      : images[0]?.url || product?.image || "";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!request.productId) return;
    const controller = new AbortController();
    api.product(request.token, request.productId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setDetail({ request, data, error: "" });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setDetail({
            request,
            data: null,
            error: getErrorMessage(error),
          });
        }
      },
    );
    return () => controller.abort();
  }, [request]);

  useEffect(() => {
    if (!promotionId) return;
    const controller = new AbortController();
    api.promotion(token, promotionId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setPromotion({ request: promotionRequest, data, error: "" });
      },
      (cause: unknown) => {
        if (!controller.signal.aborted)
          setPromotion({
            request: promotionRequest,
            data: null,
            error: getErrorMessage(cause),
          });
      },
    );
    return () => controller.abort();
  }, [token, promotionId, promotionRequest]);

  return (
    <dialog
      ref={dialogRef}
      className="product-dialog backend-product-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          onClose();
        }
      }}
    >
      <button
        ref={closeRef}
        type="button"
        className="icon-button quick-view-close"
        aria-label="Закрыть карточку товара"
        onClick={onClose}
      >
        <Icon name="close" size={20} />
      </button>
      {loading || !product ? (
        <div className="backend-detail-state" aria-busy={loading}>
          <span className="eyebrow">КАТАЛОГ</span>
          <h2 id={titleId}>Товар</h2>
          {loading ? (
            <p role="status">Загружаем информацию о товаре…</p>
          ) : (
            <div role="alert">
              <p>{current?.error || "Не удалось загрузить товар."}</p>
              <button
                type="button"
                className="backend-retry-button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Повторить загрузку
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="quick-view-grid backend-detail-grid">
            <div className="backend-product-gallery">
              <ProductImage
                product={{ name: product.name, image: activeImage }}
                eager
                className="backend-detail-image"
              />
              {images.length > 1 && (
                <div
                  className="backend-gallery-thumbnails"
                  aria-label="Фотографии товара"
                >
                  {images.map((image, index) => (
                    <button
                      key={`${image.id}-${index}`}
                      type="button"
                      className={activeImage === image.url ? "is-selected" : ""}
                      aria-label={`Фотография ${index + 1}: ${product.name}`}
                      aria-pressed={activeImage === image.url}
                      onClick={() =>
                        setSelectedImage({
                          productId: product.id,
                          url: image.url,
                        })
                      }
                    >
                      <ProductImage
                        product={{ name: product.name, image: image.url }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="quick-view-content backend-detail-content">
              <span className="eyebrow">КАРТОЧКА ТОВАРА</span>
              <h2 id={titleId}>{product.name}</h2>
              <dl className="backend-product-facts">
                {product.ratio !== null && (
                  <div>
                    <dt>В упаковке</dt>
                    <dd>
                      {product.ratio}
                      {product.unit ? ` ${product.unit}` : " ед."}
                    </dd>
                  </div>
                )}
                {product.unit && (
                  <div>
                    <dt>Единица измерения</dt>
                    <dd>{product.unit}</dd>
                  </div>
                )}
                {product.marked && (
                  <div>
                    <dt>Маркировка</dt>
                    <dd>Маркируемый товар</dd>
                  </div>
                )}
                {product.bonus !== null && product.bonus > 0 && (
                  <div>
                    <dt>Бонусы</dt>
                    <dd>{product.bonus}%</dd>
                  </div>
                )}
              </dl>
              <div className="backend-detail-pricing">
                <span className="backend-price-caption">
                  {product.ratio !== null && product.ratio > 1
                    ? "Цена за упаковку"
                    : "Цена"}
                </span>
                <div className="product-prices">
                  <span>
                    {product.price === null
                      ? "Цена не указана"
                      : currency.format(product.price)}
                  </span>
                </div>
                {product.priceOne !== null && (
                  <p>
                    {currency.format(product.priceOne)} /{" "}
                    {product.unit || "ед."}
                  </p>
                )}
                {product.wholesalePrice !== null && (
                  <p>
                    Оптовая цена:{" "}
                    <strong>{currency.format(product.wholesalePrice)}</strong>
                  </p>
                )}
                {product.wholesalePriceOne !== null && (
                  <p>
                    Оптом за {product.unit || "единицу"}:{" "}
                    {currency.format(product.wholesalePriceOne)}
                  </p>
                )}
                {product.actionId && product.actionPrice !== null && (
                  <p className="backend-promotion-price">
                    При выполнении условий акции:{" "}
                    <strong>{currency.format(product.actionPrice)}</strong>
                  </p>
                )}
              </div>
              {cartError && (
                <div className="backend-cart-error" role="alert">
                  <p>{cartError}</p>
                  <button
                    className="backend-retry-button"
                    disabled={cartRetrying}
                    onClick={onCartRetry}
                  >
                    Обновить корзину
                  </button>
                </div>
              )}
              <button
                type="button"
                className="primary-button"
                disabled={busy || product.price === null}
                onClick={() => onAdd(product)}
              >
                <Icon name={quantity > 0 ? "check" : "bag"} size={18} />
                {quantity > 0
                  ? `В корзине · ${quantity}. Добавить ещё`
                  : "Добавить в корзину"}
              </button>
            </div>
          </div>
          {promotionId && (
            <section
              className="backend-similar-products"
              aria-labelledby={`${titleId}-promotion`}
            >
              <h3 id={`${titleId}-promotion`}>Товары для акции</h3>
              <p className="backend-promotion-note">
                Акционная цена зависит от состава заказа. Итоговая стоимость
                рассчитывается в корзине.
              </p>
              {!currentPromotion ? (
                <p role="status">Загружаем товары акции…</p>
              ) : currentPromotion.error ? (
                <div role="alert">
                  <p>{currentPromotion.error}</p>
                  <button
                    className="backend-retry-button"
                    onClick={() => setPromotionAttempt((value) => value + 1)}
                  >
                    Повторить загрузку акции
                  </button>
                </div>
              ) : currentPromotion.data?.similars.length ? (
                <div className="backend-similar-grid">
                  {currentPromotion.data.similars.map((item) => (
                    <button
                      className="backend-similar-product"
                      key={item.id}
                      onClick={() => {
                        closeRef.current?.focus();
                        onOpen(item);
                      }}
                    >
                      <ProductImage product={item} />
                      <span>{item.name}</span>
                      <strong>
                        {item.price === null
                          ? "Цена не указана"
                          : currency.format(item.price)}
                      </strong>
                    </button>
                  ))}
                </div>
              ) : (
                <p>Состав акции не указан.</p>
              )}
            </section>
          )}
          {current?.data && current.data.similars.length > 0 && (
            <section
              className="backend-similar-products"
              aria-labelledby={`${titleId}-similar`}
            >
              <h3 id={`${titleId}-similar`}>Похожие товары</h3>
              <div className="backend-similar-grid">
                {current.data.similars.map((similar) => (
                  <button
                    type="button"
                    className="backend-similar-product"
                    key={similar.id}
                    onClick={() => {
                      closeRef.current?.focus();
                      onOpen(similar);
                    }}
                  >
                    <ProductImage product={similar} />
                    <span>{similar.name}</span>
                    <strong>
                      {similar.price === null
                        ? "Цена не указана"
                        : currency.format(similar.price)}
                    </strong>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </dialog>
  );
}
