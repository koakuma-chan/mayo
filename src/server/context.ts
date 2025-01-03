import {
  type Database,
} from "bun:sqlite";

import path from "node:path";

import {
  connect_and_migrate,
} from "@/server/database";

import AudioProcessor from "@/server/audio_processor";

// dprint-ignore
type Context = {
  database        : Database;

  audio_processor : AudioProcessor;

  secret          : string;
};

export default Context;

let context: Context | undefined;

export const global = (): Context => {
  if (context === undefined) {
    const database = connect_and_migrate(
      //
      path.join(process.env.MAYO_DATA_PATH, "db.sqlite"),
    );

    const audio_processor = new AudioProcessor(database);

    audio_processor.run();

    context = {
      database,

      audio_processor,

      secret: crypto.randomUUID(),
    };
  }

  return context;
};
