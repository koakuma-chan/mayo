// dprint-ignore
import type { 
  APIRoute
}             from "astro";

// dprint-ignore
import { 
  z
}             from "astro:schema";

// dprint-ignore
import path   from "node:path";

// dprint-ignore
import { 
  Id
}             from "@/types/incoming";

// dprint-ignore
import type { 
  Audio
}             from "@/types/database";

export const GET: APIRoute = async ({ url, locals }) => {
  let params;

  try {
    params = z
      //
      .object({
        id: Id,

        size: z.enum([
          "512",

          "384",

          "256",

          "128",

          "64",
        ]),
      })
      //
      .parse(
        //
        Object.fromEntries(
          //
          new URL(url).searchParams.entries(),
        ),
      );
  } catch (e) {
    return new Response(null, { status: 400 });
  }

  const audio = locals.context.database
    //
    .query(`
      select
        has_thumbnail

      from audio

      where id = ?1;
    `)
    //
    .get(params.id) as Pick<Audio, "has_thumbnail"> | null;

  if (audio?.has_thumbnail !== 1) {
    return new Response(null, { status: 404 });
  }

  const stream = Bun
    //
    .file(
      //
      path.join(
        //
        path.join(process.env.MAYO_DATA_PATH, params.id),
        //
        `thumbnail-${params.size}.webp`,
      ),
    )
    //
    .stream();

  return new Response(stream, {
    headers: {
      "content-type": "image/webp",

      "cache-control": "max-age=31536000, immutable",
    },
  });
};
