import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_USE_REAL_DATA": JSON.stringify(process.env.VITE_USE_REAL_DATA ?? "true")
  }
});

