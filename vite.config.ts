import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const SHARED_ASSET_ROOT = fileURLToPath(new URL("../slime-assets/assets", import.meta.url));
const FRONTEND_PROJECT_ROOT = fileURLToPath(new URL(".", import.meta.url));
// Linux에서는 다른 개발 도구와 inotify 한도를 공유하지 않도록 폴링한다.
const LOCAL_WATCH_POLL_INTERVAL = 500;
const LOCAL_WATCH_BINARY_INTERVAL = 1000;
const LOCAL_WATCH_IGNORED_PATHS = ["**/.local/**", "**/.tmp/**", "**/report/**"];
export default defineConfig({
  server: {
    fs: { allow: [FRONTEND_PROJECT_ROOT, SHARED_ASSET_ROOT] },
    host: "127.0.0.1",
    port: 8080,
    strictPort: true,
    watch: {
      usePolling: process.platform === "linux",
      interval: LOCAL_WATCH_POLL_INTERVAL,
      binaryInterval: LOCAL_WATCH_BINARY_INTERVAL,
      ignored: LOCAL_WATCH_IGNORED_PATHS,
    },
    proxy: {
      "^/v[12]/": { target: "http://127.0.0.1:18080", ws: true },
      "/healthz": "http://127.0.0.1:18080",
      "/readyz": "http://127.0.0.1:18080",
    },
  },
  build: {
    rollupOptions: { output: { manualChunks: { phaser: ["phaser"] } } },
  },
});
