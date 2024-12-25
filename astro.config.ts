// dprint-ignore
import { 
  defineConfig
}               from "astro/config";

// dprint-ignore
import bun      from "@nurodev/astro-bun";

// dprint-ignore
import tailwind from "@astrojs/tailwind";

// dprint-ignore
import solidJs  from "@astrojs/solid-js";

// dprint-ignore
export default defineConfig({
  output        : "server",

  adapter       : bun(),

  integrations  : [ tailwind(), solidJs() ],
});
