import type { CSSProperties, ReactNode } from "react";
import type { Product } from "../model/types.ts";
import { Icon } from "../../../shared/ui/icon/index.ts";
import ProductImage from "./ProductImage";
import "./product.css";

type ProductCardProps = {
  product: Product;
  index: number;
  action: ReactNode;
  onOpen: (product: Product) => void;
};

const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

export default function ProductCard({
  product,
  index,
  action,
  onOpen,
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
        {action}
      </div>
    </article>
  );
}
