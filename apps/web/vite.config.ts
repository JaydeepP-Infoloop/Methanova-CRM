import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = `http://localhost:${env.API_PORT ?? 4000}`;

  return {
    plugins: [react()],
    server: {
      port: Number(process.env.PORT) || 5173,
      proxy: {
        "/api": apiTarget,
        "/auth": apiTarget,
        "/health": apiTarget,
      },
    },
  };
});
