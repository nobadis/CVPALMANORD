// @ts-check
import { defineConfig } from "astro/config";

// La v2 se publica como estatico dentro de site/v2 para que el server.js
// actual la sirva en /v2/ sin tocar la web de produccion.
export default defineConfig({
  site: "https://cvpalmanord.es",
  base: "/v2",
  trailingSlash: "always",
  outDir: "../site/v2",
  build: { format: "directory", assets: "_astro" },
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  devToolbar: { enabled: false }
});
