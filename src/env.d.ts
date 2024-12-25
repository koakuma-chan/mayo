/// <reference path="../.astro/types.d.ts" />

declare module "bun" {
  interface Env {
    MAYO_DATA_PATH: string;
  }
}

declare module App {
  interface Locals {
    context: import("@/context").Context;

    user?: Pick<import("@/types/database").User, "id" | "name">;
  }
}
