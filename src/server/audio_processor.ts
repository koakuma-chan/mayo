import {
  z,
} from "astro:schema";

import type {
  Database,
} from "bun:sqlite";

import os from "node:os";

import path from "node:path";

type Item = Pick<
  //
  import("@/server/types/database").Audio,
  //
  | "id"
  //
  | "file_name"
  //
  | "processing_state"
>;

export default class AudioProcessor {
  private database: Database;

  private in_flight: Set<string>;

  private concurrency: number;

  private run_later: boolean;

  constructor(database: Database) {
    this.database = database;

    this.in_flight = new Set();

    this.concurrency = os.cpus().length;

    this.run_later = false;
  }

  public async run() {
    const limit = this.concurrency - this.in_flight.size;

    if (limit < 1) {
      this.run_later = true;

      return;
    }

    let items: Item[];

    try {
      const exclude = this.in_flight
        //
        .values()
        //
        .map(item_id => `'${item_id}'`)
        //
        .toArray()
        //
        .join(", ");

      items = this.database
        //
        .query(`
          select

            id,

            file_name,

            processing_state

          from 

            audio

          where

            processing = 1

            and

            id not in (${exclude})

          order by 

            time_uploaded;
        `)
        //
        .all() as Item[];
    } catch (e) {
      console.log(`database access error: ${e}`);

      return;
    }

    if (items.length > limit) {
      this.run_later = true;
    }

    for (const item of items.slice(0, limit)) {
      this.in_flight.add(item.id);

      (async () => {
        try {
          const run_later = await this.dispatch(item);

          if (run_later) {
            this.run_later = true;
          }
        } catch (e) {
          console.log(`error processing ${item.file_name} (id: ${item.id}) at state ${item.processing_state}: ${e}`);
        } finally {
          this.in_flight.delete(item.id);

          if (this.run_later) {
            this.run_later = false;

            this.run();
          }
        }
      })();
    }
  }

  private set_processing_state_to_error(item_id: Item["id"]) {
    this.database
      //
      .query(`
        update 

          audio 

        set 
          processing        = 0,

          processing_state  = 1

        where 

          id = ?1;
      `)
      //
      .run(item_id);
  }

  private async dispatch(item: Item): Promise<boolean> {
    switch (item.processing_state) {
      case 0:
        await this.metadata(
          //
          item,
        );

        return true;

      case 2:
        await this.thumbnail(
          //
          item,
        );

        return true;

      case 3:
        await this.transcode(
          //
          item,
        );

        return false;

      default:
        throw new Error(`encountered an item with an unexpected state: ${item.processing_state}`);
    }
  }

  private async metadata(item: Item) {
    const probe = z.object({
      streams: z
        //
        .object({ codec_type: z.string() })
        //
        .array(),

      format: z.object({
        duration: z
          //
          .string()
          //
          .transform(value => Math.round(parseFloat(value))),

        tags: z
          //
          .record(z.string())
          //
          .transform(value => JSON.stringify(Object.entries(value))),
      }),
    });

    const proc = Bun.spawn(
      [
        "ffprobe",

        ["-v", "quiet"],

        ["-of", "json"],

        ["-show_entries", "format:stream_tags:stream=codec_type"],

        item.file_name,
      ]
        .flat(),
      {
        cwd: path.join(process.env.MAYO_DATA_PATH, item.id),
      },
    );

    switch (await proc.exited) {
      case 0:
        //

        break;

      case 1:
        this.set_processing_state_to_error(item.id);

        return;

      default:
        throw new Error("ffprobe exited with an unexpected code");
    }

    let output;

    try {
      output = probe.parse(await Bun.readableStreamToJSON(proc.stdout));
    } catch (e) {
      throw new Error(`failed to parse ffprobe output: ${e}`);
    }

    let has_audio = false, has_video = false;

    for (const stream of output.streams) {
      switch (stream.codec_type) {
        case "audio":
          has_audio = true;

          break;

        case "video":
          has_video = true;

          break;
      }
    }

    if (!has_audio) {
      this.set_processing_state_to_error(item.id);

      return;
    }

    this.database
      //
      .query(`
        update 

          audio


        set
          processing_state  = ?1,

          duration          = ?2,
          
          tags              = ?3

        where 

          id = ?4;
      `)
      //
      .run(
        //
        has_video ? 2 : 3,
        //
        output.format.duration,
        //
        output.format.tags,
        //
        item.id,
      );
  }

  private async thumbnail(item: Item) {
    const proc = Bun.spawn(
      [
        "ffmpeg",

        ["-loglevel", "quiet"],

        ["-i", item.file_name],

        "-y",

        ["-frames", "1"],

        ["-vf", "crop='if(gt(iw,ih),ih,iw)':'if(gt(iw,ih),ih,iw)',scale=512:512"],

        "thumbnail-512.webp",
      ]
        .flat(),
      {
        cwd: path.join(process.env.MAYO_DATA_PATH, item.id),
      },
    );

    let exit_code = await proc.exited;

    for (const size of ["384", "256", "128", "64"]) {
      const proc = Bun.spawn(
        [
          "ffmpeg",

          ["-loglevel", "quiet"],

          ["-i", "thumbnail-512.webp"],

          "-y",

          ["-vf", `crop='if(gt(iw,ih),ih,iw)':'if(gt(iw,ih),ih,iw)',scale=${size}:${size}`],

          `thumbnail-${size}.webp`,
        ]
          .flat(),
        {
          cwd: path.join(process.env.MAYO_DATA_PATH, item.id),
        },
      );

      exit_code = await proc.exited;

      if (exit_code === 1) {
        break;
      }
    }

    this.database
      //
      .query(`
        update 

          audio

        set

          processing_state  = ?1,

          has_thumbnail     = ?2

        where 

          id = ?3;
      `)
      //
      .run(
        //
        3,
        //
        exit_code === 0 ? 1 : 0,
        //
        item.id,
      );
  }

  private async transcode(item: Item) {
    const proc = Bun.spawn(
      [
        "ffmpeg",

        ["-loglevel", "quiet"],

        ["-i", item.file_name],

        "-y",

        ["-map", "0:a"],

        ["-c:a", "aac"],

        ["-b:a", "256k"],

        ["-ar", "44100"],

        ["-movflags", "+faststart"],

        "audio.mp4",
      ]
        .flat(),
      {
        cwd: path.join(process.env.MAYO_DATA_PATH, item.id),
      },
    );

    switch (await proc.exited) {
      case 0:
        this.database
          //
          .query(`
            update 

              audio

            set

              processing = ?1

            where 

              id = ?2;
          `)
          //
          .run(
            //
            0,
            //
            item.id,
          );

        break;

      case 1:
        this.set_processing_state_to_error(item.id);

        break;

      default:
        throw new Error("ffmpeg exited with an unexpected code");
    }
  }
}
