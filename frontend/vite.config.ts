import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5500,
    proxy: {
      // Todos los endpoints REST cuelgan de /api/v1 (consigna §6): passthrough directo.
      "/api/v1": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      // Endpoints WebSocket en la raíz /ws/* (consigna §9).
      "/ws": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
