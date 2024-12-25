import { z } from "astro:schema";

export const Id = z
  //
  .string()
  //
  .length(36);

export type Id = z.infer<typeof Id>;

export const Username = z
  //
  .string()
  //
  .min(3)
  //
  .max(24)
  //
  .regex(/^[a-zA-Z0-9]+$/);

export type Username = z.infer<typeof Username>;

export const Password = z
  //
  .string()
  //
  .min(8)
  //
  .max(64);

export type Password = z.infer<typeof Password>;
