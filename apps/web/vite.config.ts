import { cpSync, createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const standardFonts = fileURLToPath(
  new URL("./node_modules/pdfjs-dist/standard_fonts", import.meta.url),
);

/** pdf.js asks for Helvetica by filename. Keep those names stable under /app/standard_fonts. */
function pdfStandardFonts(): Plugin {
  return {
    name: "pdfjs-standard-fonts",
    configureServer(server) {
      server.middlewares.use("/app/standard_fonts", (req, res, next) => {
        const name = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "").replace(/^\//, "");
        if (!/^[\w.-]+$/.test(name)) {
          next();
          return;
        }
        const file = join(standardFonts, name);
        if (!existsSync(file) || !statSync(file).isFile()) {
          next();
          return;
        }
        createReadStream(file).pipe(res);
      });
    },
    writeBundle(options) {
      const out = join(options.dir ?? "dist", "standard_fonts");
      mkdirSync(out, { recursive: true });
      cpSync(standardFonts, out, { recursive: true, dereference: true });
    },
  };
}

export default defineConfig({
  base: "/app/",
  plugins: [
    pdfStandardFonts(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "Southeast Grants",
        short_name: "SE Grants",
        description: "Track grant deadlines for Southeast Alaska organizations.",
        theme_color: "#0f5c57",
        background_color: "#f6f4ef",
        display: "standalone",
        start_url: "/app/",
        scope: "/app/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        navigateFallback: "/app/index.html",
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      // The shared package compiles to CommonJS for Nest. Vite imports the
      // TypeScript source so named exports stay visible to the bundler.
      "@se-grants/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
