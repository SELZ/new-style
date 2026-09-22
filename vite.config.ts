import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      proxy: env.API_PROXY_TARGET
        ? { "/b2b": { target: env.API_PROXY_TARGET, changeOrigin: true } }
        : undefined,
    },
  };
});
