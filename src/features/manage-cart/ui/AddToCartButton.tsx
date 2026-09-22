import type { Product } from "../../../entities/product/index.ts";
import { Icon } from "../../../shared/ui/icon/index.ts";

type Props = {
  product: Product;
  quantity: number;
  busy: boolean;
  onAdd: (product: Product) => void;
  variant?: "card" | "detail";
};

export function AddToCartButton({ product, quantity, busy, onAdd, variant = "card" }: Props) {
  const detail = variant === "detail";
  return <button
    type="button"
    className={detail ? "primary-button" : `add-to-cart ${quantity > 0 ? "is-added" : ""}`}
    disabled={busy || product.price === null}
    onClick={() => onAdd(product)}
    aria-label={detail ? undefined : `Добавить в корзину: ${product.name}`}
  >
    <Icon name={quantity > 0 ? "check" : "bag"} size={detail ? 18 : 16} />
    {quantity > 0 ? `В корзине · ${quantity}${detail ? ". Добавить ещё" : ""}` : detail ? "Добавить в корзину" : "В корзину"}
    {!detail && quantity > 0 && <Icon name="plus" size={14} />}
  </button>;
}
