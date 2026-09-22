import { useCallback, useEffect, useRef, useState } from "react";
import { cartApi, type Cart } from "../../../entities/cart/index.ts";
import { getErrorMessage } from "../../../shared/api/index.ts";

export function useServerCart(token: string) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const mounted = useRef(false);
  const readController = useRef<AbortController | null>(null);

  const read = useCallback(() => {
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    return cartApi
      .cart(token, controller.signal)
      .then(
        (response) => {
          if (!mounted.current || controller.signal.aborted) return false;
          setCart(response);
          setError("");
          return true;
        },
        (cause: unknown) => {
          if (mounted.current && !controller.signal.aborted)
            setError(getErrorMessage(cause));
          return false;
        },
      )
      .finally(() => {
        if (readController.current === controller)
          readController.current = null;
        if (mounted.current && !controller.signal.aborted) setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    mounted.current = true;
    void read();
    return () => {
      mounted.current = false;
      readController.current?.abort();
    };
  }, [read]);

  async function mutate(request: () => Promise<void>) {
    if (locked.current || readController.current || loading || error || !cart)
      return false;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await request();
      if (!mounted.current) return false;
      // Mutations return no data; fetch authoritative quantities and totals afterwards.
      setLoading(true);
      return await read();
    } catch (cause) {
      if (mounted.current)
        setError(
          `${getErrorMessage(cause)} Обновите корзину перед следующим изменением.`,
        );
      return false;
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return {
    cart,
    loading,
    busy,
    error,
    reload: () => {
      if (locked.current) return Promise.resolve(false);
      setLoading(true);
      return read();
    },
    add: (id: string) => mutate(() => cartApi.addToCart(token, id, 1)),
    minus: (id: string) => mutate(() => cartApi.minusFromCart(token, id)),
    remove: (id: string) => mutate(() => cartApi.removeFromCart(token, id)),
    clear: () => mutate(() => cartApi.clearCart(token)),
  };
}

export type CartController = ReturnType<typeof useServerCart>;
