import { useEffect, useState } from "react";
import type { Product } from "../../../entities/product/index.ts";
import type { Session } from "../../../entities/session/index.ts";
import { AddToCartButton, useServerCart } from "../../../features/manage-cart/index.ts";
import { Icon } from "../../../shared/ui/icon/index.ts";
import { CartDrawer } from "../../../widgets/cart-drawer/index.ts";
import { ProductDialog } from "../../../widgets/product-details/index.ts";
import { SiteHeader } from "../../../widgets/site-header/index.ts";
import { SiteFooter } from "../../../widgets/site-footer/index.ts";
import { useCatalog } from "../model/useCatalog.ts";
import { CatalogContent } from "./CatalogContent.tsx";

export function CatalogPage({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const catalog = useCatalog(session.token);
  const cart = useServerCart(session.token);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (!announcement) return;
    const timeout = window.setTimeout(() => setAnnouncement(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [announcement]);
  const count = cart.cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const quantity = (id: string) => cart.cart?.items.filter((item) => item.productId === id).reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const actionsDisabled = cart.busy || cart.loading || Boolean(cart.error) || !cart.cart;
  async function add(product: Product) {
    if (await cart.add(product.id)) setAnnouncement("Корзина обновлена");
  }
  function renderCartAction(product: Product, variant: "card" | "detail" = "card") {
    return <AddToCartButton product={product} variant={variant} quantity={quantity(product.id)} busy={actionsDisabled} onAdd={(item) => void add(item)} />;
  }
  return <>
    <SiteHeader count={count} loading={cart.loading} busy={cart.busy} onCatalog={() => catalog.navigate([])} onCart={() => setCartOpen(true)} onLogout={onLogout} />
    <CatalogContent catalog={catalog} cart={cart} onOpen={(product) => setSelectedId(product.id)} renderProductAction={renderCartAction} />
    <SiteFooter onCatalog={() => catalog.navigate([])} />
    <div className={`toast ${announcement ? "is-visible" : ""}`} role="status" aria-live="polite"><Icon name="check" size={16} />{announcement}</div>
    <CartDrawer open={cartOpen} cart={cart.cart} loading={cart.loading} busy={cart.busy} error={cart.error} onClose={() => setCartOpen(false)} onRetry={() => void cart.reload()} onAdd={(id) => void cart.add(id)} onMinus={(id) => void cart.minus(id)} onRemove={(id) => void cart.remove(id)} onClear={() => void cart.clear()} />
    <ProductDialog cartError={cart.error} cartRetrying={cart.loading || cart.busy} onCartRetry={() => void cart.reload()} productId={selectedId} token={session.token} onClose={() => setSelectedId(null)} renderCartAction={(product) => renderCartAction(product, "detail")} onOpen={(product) => setSelectedId(product.id)} />
  </>;
}
