import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const port = Number(process.env.PORT) || 3250;

export default defineConfig({
  plugins: [react()],
  server: {
    port,
    strictPort: true,
  },
  preview: { port, strictPort: true },
});
