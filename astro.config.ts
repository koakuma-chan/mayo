import {
  defineConfig,
} from "astro/config";

import bun from "@nurodev/astro-bun";

import tailwindcss from "@tailwindcss/vite";

import solidJs from "@astrojs/solid-js";

export default defineConfig({
  output: "server",

  adapter: bun(),

  integrations: [solidJs()],

  vite: {
    // @ts-ignore
    plugins: [tailwindcss()],
  },
});
