// dprint-ignore
import { 
  defineMiddleware
}   from "astro:middleware";

// dprint-ignore
import { 
  z
}   from "astro:schema";

// dprint-ignore
import { 
  global
}   from "@/context";

// dprint-ignore
import { 
  Id
}   from "@/types/incoming";

// dprint-ignore
import type { 
  User
}   from "@/types/database";

export const onRequest = defineMiddleware((request, next) => {
  const locals = request.locals;

  locals.context = global();

  // dprint-ignore
  const authenticate =

        request.url.pathname === "/"

    ||  request.url.pathname.startsWith("/endpoints")

    ||  request.url.pathname.startsWith("/_actions");

  if (!authenticate) {
    return next();
  }

  const cookie = request.cookies.get("token");

  if (!cookie) {
    return request.redirect("/sign-up");
  }

  let payload;

  try {
    payload = z
      //
      .object({
        user_id: Id,

        signature: z.string(),
      })
      //
      .parse(cookie.json());
  } catch (e) {
    return request.redirect("/sign-up");
  }

  const hasher = new Bun.CryptoHasher("blake2b512", locals.context.secret);

  hasher.update(payload.user_id);

  const signature = hasher.digest("hex");

  if (signature !== payload.signature) {
    return request.redirect("/sign-up");
  }

  const user = locals.context.database
    //
    .query("select name from users where id = ?1")
    //
    .get(payload.user_id) as Pick<User, "name"> | null;

  if (user === null) {
    return request.redirect("/sign-up");
  }

  locals.user = { id: payload.user_id, ...user };

  return next();
});
