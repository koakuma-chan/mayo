import node from "@astrojs/node";

import tailwind from "@astrojs/tailwind";

import { defineConfig } from "astro/config";

import solidJs from "@astrojs/solid-js";

export default defineConfig({
  output: "server",
  integrations: [tailwind(), solidJs()],
  adapter: node({
    mode: "standalone",
  }),
});
