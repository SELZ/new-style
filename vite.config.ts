import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { demoDataPlugin } from "./tools/demo-data-plugin.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), demoDataPlugin()],
    server: {
      proxy: env.API_PROXY_TARGET
        ? { "/b2b": { target: env.API_PROXY_TARGET, changeOrigin: true } }
        : undefined,
    },
  };
});
