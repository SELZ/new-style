import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/shop.css";
import { App } from "./App.tsx";

export function bootstrap(element: HTMLElement) {
  createRoot(element).render(<StrictMode><App /></StrictMode>);
}
