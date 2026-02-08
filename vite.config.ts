import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        background: resolve(__dirname, "background.html")
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@mui")) return "vendor_mui";
          if (id.includes("@emotion")) return "vendor_emotion";
          if (id.includes("zod")) return "vendor_zod";
          if (id.includes("@owlbear-rodeo")) return "vendor_obr";
          if (id.includes("react")) return "vendor_react";
          return "vendor";
        }
      }
    }
  },
  server: {
    // Owlbear loads your extension inside an iframe at https://www.owlbear.rodeo
    cors: { origin: "https://www.owlbear.rodeo" },
    host: true,
    port: 5173
  }
});
