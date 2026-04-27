import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    // Output goes to ../frontend/templates/ so Flask can serve it directly.
    // Run `npm run build` from the frontend/ directory.
    outDir: path.resolve(__dirname, "templates"),
    emptyOutDir: false,          // don't wipe the Jinja2 templates
    rollupOptions: {
      output: { entryFileNames: "app.html" },
    },
  },
  server: {
    // In dev, proxy all /api and /health calls to the Flask backend
    proxy: {
      "/api":    { target: "http://localhost:5000", changeOrigin: true },
      "/health": { target: "http://localhost:5000", changeOrigin: true },
    },
  },
});
