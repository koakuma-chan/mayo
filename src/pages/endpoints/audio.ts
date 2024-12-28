import {
  type APIRoute,
} from "astro";

import {
  z,
} from "astro:schema";

import path from "node:path";

import {
  Id,
} from "@/server/types/incoming";

import {
  type Audio,
} from "@/server/types/database";

export const GET: APIRoute = async ({ url, locals }) => {
  let params;

  try {
    params = z
      //
      .object({
        id: Id,
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

        processing,

        processing_state

      from 

        audio

      where 

        id = ?1;
    `)
    //
    .get(params.id) as Pick<Audio, "processing" | "processing_state"> | null;

  if (audio?.processing !== 0 || audio?.processing_state === 1) {
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
        "audio.mp4",
      ),
    )
    //
    .stream();

  return new Response(stream, {
    headers: {
      "content-type": "audio/mp4",

      "cache-control": "max-age=31536000, immutable",
    },
  });
};
