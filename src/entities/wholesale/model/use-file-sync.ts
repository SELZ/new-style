import { useSyncExternalStore } from "react";
import { browserStorage } from "./persistence.ts";
import { createFileSync } from "./file-sync.ts";
import { store } from "./store.ts";

export const fileSync = createFileSync({
  store,
  fetcher: (...args) => fetch(...args),
  storage: browserStorage(),
});
export const useFileSync = () =>
  useSyncExternalStore(
    fileSync.subscribe,
    fileSync.getSnapshot,
    fileSync.getSnapshot,
  );
export function downloadWorkspace() {
  const url = URL.createObjectURL(
    new Blob([fileSync.downloadJson()], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "demo-state.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (event) => {
    if (fileSync.hasPending()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}
