import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: [".devtunnels.ms", ".github.dev", "localhost"],
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
