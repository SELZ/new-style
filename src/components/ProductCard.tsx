import type { CSSProperties } from "react";
import type { Product } from "../api/types";
import Icon from "./Icon";
import ProductImage from "./ProductImage";
import "./BackendComponents.css";

type ProductCardProps = {
  product: Product;
  index: number;
  quantity: number;
  busy: boolean;
  onOpen: (product: Product) => void;
  onAdd: (product: Product) => void;
};

const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

export default function ProductCard({
  product,
  index,
  quantity,
  busy,
  onOpen,
  onAdd,
}: ProductCardProps) {
  const packageLabel =
    product.ratio !== null && product.ratio > 1
      ? `Упаковка · ${product.ratio}${product.unit ? ` ${product.unit}` : " ед."}`
      : product.unit || "Товар";

  return (
    <article
      className="product-card backend-product-card"
      style={{ "--card-index": Math.min(index, 7) } as CSSProperties}
    >
      <div className="product-media">
        <button
          type="button"
          className="product-image-button"
          aria-label={`Подробнее: ${product.name}`}
          onClick={() => onOpen(product)}
        >
          <ProductImage product={product} eager={index < 4} />
        </button>
        {product.actionId && (
          <div className="product-badges">
            <span className="product-badge sale-badge">Акция</span>
          </div>
        )}
        <span className="product-quick-view">
          Подробнее о товаре
          <Icon name="arrow-up-right" size={14} />
        </span>
      </div>
      <div className="product-info">
        <div className="product-meta">
          <span>{packageLabel}</span>
          {product.marked && <span title="Маркируемый товар">Маркировка</span>}
        </div>
        <button
          type="button"
          className="product-name"
          onClick={() => onOpen(product)}
        >
          {product.name}
        </button>
        <div className="product-prices">
          <span>
            {product.price === null
              ? "Цена не указана"
              : currency.format(product.price)}
          </span>
        </div>
        <div className="backend-card-price-details">
          {product.priceOne !== null && (
            <p>
              {currency.format(product.priceOne)} / {product.unit || "ед."}
            </p>
          )}
          {product.wholesalePrice !== null && (
            <p>Оптовая цена: {currency.format(product.wholesalePrice)}</p>
          )}
          {product.actionId && product.actionPrice !== null && (
            <p className="backend-promotion-price">
              По условиям акции: {currency.format(product.actionPrice)}
            </p>
          )}
        </div>
        <button
          type="button"
          className={`add-to-cart ${quantity > 0 ? "is-added" : ""}`}
          disabled={busy || product.price === null}
          onClick={() => onAdd(product)}
          aria-label={`Добавить в корзину: ${product.name}`}
        >
          <Icon name={quantity > 0 ? "check" : "bag"} size={16} />
          {quantity > 0 ? `В корзине · ${quantity}` : "В корзину"}
          {quantity > 0 && <Icon name="plus" size={14} />}
        </button>
      </div>
    </article>
  );
}
