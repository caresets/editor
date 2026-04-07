import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/build": "http://localhost:8080",
      "/sushi": "http://localhost:8080",
      "/gofsh": "http://localhost:8080",
      "/jekyll": "http://localhost:8080",
      "/validate": "http://localhost:8080",
      "/health": "http://localhost:8080",
    },
  },
});
