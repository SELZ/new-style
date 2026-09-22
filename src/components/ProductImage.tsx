import { useState } from "react";
import type { Product } from "../api/types";
import Icon from "./Icon";

type ProductImageProps = {
  product: Pick<Product, "name" | "image">;
  eager?: boolean;
  className?: string;
};

export default function ProductImage({
  product,
  eager,
  className,
}: ProductImageProps) {
  return (
    <ProductImageContent
      key={product.image}
      product={product}
      eager={eager}
      className={className}
    />
  );
}

function ProductImageContent({
  product,
  eager = false,
  className = "",
}: ProductImageProps) {
  // The parent remounts this state when the URL changes, including after failure.
  const [imageState, setImageState] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  const status = product.image ? imageState : "failed";

  return (
    <div
      className={`product-image backend-product-image ${status === "loading" ? "is-loading" : "is-loaded"} ${className}`}
    >
      {status === "failed" ? (
        <div className="image-fallback" role="img" aria-label={product.name}>
          <Icon name="grid" size={40} />
          <span>Фото отсутствует</span>
        </div>
      ) : (
        <img
          src={product.image}
          alt={product.name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          width="600"
          height="600"
          onLoad={() => setImageState("loaded")}
          onError={() => setImageState("failed")}
        />
      )}
    </div>
  );
}
