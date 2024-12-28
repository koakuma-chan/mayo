import {
  defineMiddleware,
  sequence,
} from "astro:middleware";

import {
  z,
} from "astro:schema";

import {
  global,
} from "@/server/context";

import {
  sign,
} from "@/server/crypto";

import {
  Id,
} from "@/server/types/incoming";

import {
  User,
} from "@/server/types/database";

const context =
  //
  defineMiddleware((request, next) => {
    request.locals.context = global();

    return next();
  });

const authentication =
  //
  defineMiddleware((request, next) => {
    // dprint-ignore
    const needs_authentication =
          request.url.pathname === "/"

      ||  request.url.pathname === "/endpoints/audio"

      ||  request.url.pathname.startsWith("/_actions");

    if (!needs_authentication) {
      return next();
    }

    const cookie = request.cookies.get("token");

    if (!cookie) {
      return request.redirect("/sign-up");
    }

    const schema = z.object({
      user_id: Id,

      signature: z.string(),
    });

    let payload;

    try {
      payload = schema.parse(cookie.json());
    } catch (e) {
      return request.redirect("/sign-up");
    }

    const {
      user_id,

      signature,
    } = payload;

    const {
      secret,

      database,
    } = request.locals.context;

    if (signature !== sign(secret, user_id)) {
      return request.redirect("/sign-up");
    }

    const user = database
      //
      .query(`
        select

          name

        from 

          users

        where 

          id = ?1;
      `)
      //
      .get(user_id) as Pick<User, "name"> | null;

    if (user === null) {
      return request.redirect("/sign-up");
    }

    request.locals.user = { id: user_id, ...user };

    return next();
  });

export const onRequest = sequence(context, authentication);
