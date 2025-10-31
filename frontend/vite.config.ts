import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import checker from "vite-plugin-checker";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Run TypeScript type-checking in a separate thread for dev and build
    checker({ typescript: true }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Frontend will call `/api/...` and keep the prefix when proxying to the backend
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
        // No rewrite: preserve `/api` so backend also sees the prefix
      },
    },
  },
  preview: {
    port: 5173,
  },
});
