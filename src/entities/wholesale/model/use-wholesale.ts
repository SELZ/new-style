import { useSyncExternalStore } from "react";
import { store } from "./store.ts";

export function useWholesale() {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  );
  const user =
    state.users.find(
      (item) => item.id === state.sessionUserId && item.active,
    ) ?? null;
  return { state, user };
}
