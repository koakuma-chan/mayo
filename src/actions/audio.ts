// dprint-ignore
import { 
  ActionError,

  defineAction
}               from "astro:actions";

// dprint-ignore
import { z }    from "astro:schema";

// dprint-ignore
import path     from "node:path";

// dprint-ignore
import fs       from "node:fs/promises";

// dprint-ignore
import { Id }   from "@/types/incoming";

export type Item = Pick<
  //
  import("@/types/database").Audio,
  //
  | "id"
  //
  | "file_name"
  //
  | "processing"
  //
  | "processing_state"
  //
  | "has_thumbnail"
  //
  | "duration"
  //
  | "size"
  //
  | "tags"
>;

export const audio = {
  create: defineAction({
    accept: "form",

    input: z.object({
      data: z
        //
        .instanceof(File)
        //
        .array()
        //
        .nonempty(),
    }),

    handler: async (
      //
      input,
      //
      request,
    ) => {
      const {
        context,

        user,
      } = request.locals;

      if (user === undefined) {
        throw new ActionError({ code: "UNAUTHORIZED", message: "Unauthorized." });
      }

      const tasks = input.data.map(async file => {
        // dprint-ignore
        const id              = Bun.randomUUIDv7(),

              uploader_id     = user.id,

              time_uploaded   = Date.now(),

              file_name       = file.name;

        // dprint-ignore
        const directory_path  = path.join(process.env.MAYO_DATA_PATH, id),

              file_path       = path.join(directory_path, file.name);

        try {
          await Bun.write(
            //
            file_path,
            //
            file,
          );

          context.database
            //
            .query(`
              insert into audio

              (
                id, 

                uploader_id, 

                time_uploaded,

                file_name
              ) 

              values 

              (
                ?1,

                ?2,

                ?3,

                ?4
              );
            `)
            //
            .run(
              //
              id,
              //
              uploader_id,
              //
              time_uploaded,
              //
              file_name,
            );

          context.audio_processor.run();
        } catch (e) {
          console.log(`failed to create an audio: ${e}`);

          // dprint-ignore
          fs.rm(directory_path, {
            recursive : true,

            force     : true,
          });
        }
      });

      await Promise.all(tasks);
    },
  }),

  get_one: defineAction({
    input: Id,

    handler: (
      //
      input,
      //
      request,
    ) => {
      const { context } = request.locals;

      const audio = context.database
        //
        .query(`
          select
            id,

            file_name,

            processing,

            processing_state,

            has_thumbnail,

            duration,

            size,

            tags

          from audio

          where id = ?1
        `)
        //
        .get(input) as Item | null;

      return audio;
    },
  }),

  get_page: defineAction({
    input: z
      //
      .number()
      //
      .nonnegative(),

    handler: (
      //
      input,
      //
      request,
    ) => {
      const { context } = request.locals;

      const page_size = 32;

      const page = context.database
        //
        .query(`
          select
            id,

            file_name,

            processing,

            processing_state,

            has_thumbnail,

            duration,

            size,

            tags

          from audio

          order by time_uploaded desc

          limit ?1 offset ?2;
        `)
        //
        .all(page_size, page_size * input) as Array<Item>;

      return page;
    },
  }),
};
