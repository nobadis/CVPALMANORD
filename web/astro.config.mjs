// @ts-check
import { defineConfig } from "astro/config";

// El sitio se compila como estatico en dist/, que es lo que sirve server.js.
export default defineConfig({
  site: "https://cvpalmanord.es",
  trailingSlash: "always",
  outDir: "../dist",
  build: { format: "directory", assets: "_astro" },
  prefetch: { prefetchAll: true, defaultStrategy: "viewport" },
  devToolbar: { enabled: false }
});
