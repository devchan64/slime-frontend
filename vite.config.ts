import { defineConfig } from "vite";
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 8080,
    strictPort: true,
    proxy: {
      "/v1": { target: "http://127.0.0.1:18080", ws: true },
      "/healthz": "http://127.0.0.1:18080",
      "/readyz": "http://127.0.0.1:18080",
    },
  },
  build: {
    rollupOptions: { output: { manualChunks: { phaser: ["phaser"] } } },
  },
});
