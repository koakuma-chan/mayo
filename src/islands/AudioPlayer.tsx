import {
  actions,
} from "astro:actions";

import {
  type Component,
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import {
  makeAudioPlayer,
} from "@solid-primitives/audio";

import {
  createContextProvider,
} from "@solid-primitives/context";

import {
  makeEventListener,
} from "@solid-primitives/event-listener";

import {
  createInfiniteScroll,
} from "@solid-primitives/pagination";

import {
  type Item as Audio,
} from "@/actions/audio";

import {
  FadeIn,
} from "@/components";

// dprint-ignore
type Item = {
  audio     : Audio;

  duration  : string | undefined;

  artist    : string | undefined;

  album     : string | undefined;

  title     : string | undefined;
};

const parse_audio = (audio: Audio): Item => {
  let duration;

  if (audio.duration) {
    // dprint-ignore
    const 

      hours     = Math.floor(audio.duration / 3600),

      minutes   = Math.floor((audio.duration % 3600) / 60),

      seconds   = audio.duration % 60;

    //
    const pad = (num: number) => String(num).padStart(2, "0");

    // dprint-ignore
    duration = 
      (

        hours > 0 

          ?
            `
              ${pad(hours)}
              :
              ${pad(minutes)}
              :
              ${pad(seconds)}
            `

          : 

            `
              ${pad(minutes)}
              :
              ${pad(seconds)}
            `

      )
        .replace(/\s+/g, "");
  }

  // dprint-ignore
  let 

    artist  , 

    album   , 

    title   ;

  if (audio.tags) {
    const tags = new Map((JSON.parse(audio.tags) as string[][]).map(([k, v]) => [k.toLowerCase(), v]));

    artist =
      //
      tags.get(
        "artist",
      );

    album =
      //
      tags.get(
        "album",
      );

    title =
      //
      tags.get(
        "title",
      );
  }

  return {
    audio,

    duration,

    artist,

    album,

    title,
  };
};

type FetcherStrategy = {
  //
  fetch_one: (
    //
    id: Audio["id"],
  ) => Promise<Audio | null>;

  //
  fetch_page: (
    //
    index: number,
  ) => Promise<Audio[]>;
};

const fetcher_strategy_network: FetcherStrategy = {
  fetch_one:
    //
    (
      id,
    ) =>
      actions.audio.get_one.orThrow(
        id,
      ),

  fetch_page:
    //
    (
      index,
    ) =>
      actions.audio.get_page.orThrow(
        index,
      ),
};

const fetcher_strategy_offline: FetcherStrategy = {
  fetch_one:
    //
    (
      id,
    ) => {
      throw new Error("unimplemented");
    },

  fetch_page:
    //
    (
      index,
    ) => {
      throw new Error("unimplemented");
    },
};

type Fetcher = {
  //
  fetch_one: (
    //
    id: Audio["id"],
  ) => Promise<Item | null>;

  //
  fetch_page: (
    //
    index: number,
  ) => Promise<Item[]>;
};

const make_fetcher = (strategy: FetcherStrategy): Fetcher => {
  return {
    fetch_one: async (
      id,
    ) => {
      const audio =
        //
        await strategy.fetch_one(
          id,
        );

      return audio
        //
        ? parse_audio(audio)
        //
        : null;
    },

    fetch_page: async (
      index,
    ) => {
      const page =
        //
        await strategy.fetch_page(
          index,
        );

      return page.map(parse_audio);
    },
  };
};

const [
  QueueProvider,

  use_queue,
] = createContextProvider(() => {
  const [
    current,

    set_current,
  ] = createSignal<
    //
    Item | null
  >(null);

  createEffect(() => {
    const item = current();

    if (item) {
      const player = makeAudioPlayer(`/endpoints/audio?id=${item.audio.id}`);

      player.play();

      update_media_session(item);
    }
  });

  const replace = (item: Item) => set_current(item);

  return { replace };
});

const update_media_session = (item: Item) => {
  if ("mediaSession" in navigator) {
    // dprint-ignore
    navigator.mediaSession.playbackState  = "playing";

    // dprint-ignore
    navigator.mediaSession.metadata       = new MediaMetadata({
      title   : item.title  ,

      artist  : item.artist ,

      album   : item.album  ,

      artwork : item.audio.has_thumbnail
        ?
          [
            {
              src: `/endpoints/thumbnail?id=${item.audio.id}&size=64`,

              sizes: "64x64",
            },

            {
              src: `/endpoints/thumbnail?id=${item.audio.id}&size=128`,

              sizes: "128x128",
            },

            {
              src: `/endpoints/thumbnail?id=${item.audio.id}&size=256`,

              sizes: "256x256",
            },

            {
              src: `/endpoints/thumbnail?id=${item.audio.id}&size=512`,

              sizes: "512x512",
            },
          ]
        :
          [],
    });
  }
};

const AudioPlayer: Component = () => {
  const [
    fetcher,

    set_fetcher,
  ] = createSignal(
    make_fetcher(fetcher_strategy_network),
  );

  // dprint-ignore
  type page_maybe_fade_in = {
    fade_in : boolean ;

    page    : Item[]  ;
  };

  const fetch_page_maybe_fade_in = async (index: number): Promise<page_maybe_fade_in[]> => {
    const page = await fetcher().fetch_page(index);

    return [
      // dprint-ignore
      {
        fade_in: true ,

        page          ,
      },
    ];
  };

  const [
    pages,

    setEl,

    {
      end,

      setPages,
    },
  ] = createInfiniteScroll<page_maybe_fade_in>(fetch_page_maybe_fade_in);

  onMount(() => {
    const handle_swap = async () =>
      setPages(
        await fetch_page_maybe_fade_in(0),
      );

    makeEventListener(document, "astro:after-swap", handle_swap, { passive: true });
  });

  const timers = new Map();

  onCleanup(() => timers.forEach(clearInterval));

  createEffect(() => {
    pages()
      //
      .flatMap(
        ({ page }) => page.map(({ audio }) => audio),
      )
      //
      .filter(
        audio => audio.processing === 1 && timers.has(audio.id) === false,
      )
      //
      .forEach(
        audio => {
          const poll = async () => {
            const fresh = await fetcher().fetch_one(audio.id);

            if (fresh === null || fresh.audio.processing === 0) {
              clearInterval(timer);

              timers.delete(audio.id);
            }

            if (fresh === null) {
              setPages(pages =>
                pages.map(({ page }) => {
                  // dprint-ignore
                  return {
                    fade_in : false,

                    page    : page.filter(previous => audio.id !== previous.audio.id),
                  };
                })
              );
            } else {
              if (
                fresh.audio.processing !== audio.processing || fresh.audio.processing_state !== audio.processing_state
              ) {
                setPages(pages =>
                  pages.map(({ page }) => {
                    // dprint-ignore
                    return {
                      fade_in : false,

                      page    : page.map(previous => previous.audio.id === audio.id ? fresh : previous),
                    };
                  })
                );
              }
            }
          };

          const timer = setInterval(poll, 1000);

          timers.set(audio.id, timer);
        },
      );
  });

  return (
    <QueueProvider>
      <ol class="grid gap-1">
        <For each={pages()}>
          {({
            fade_in,

            page,
          }) => (
            <For each={page}>
              {(item, index) => (
                fade_in
                  ? (
                    <FadeIn
                      //
                      duration={500}
                      //
                      delay={index() * 20}
                    >
                      <Item {...item} />
                    </FadeIn>
                  )
                  : <Item {...item} />
              )}
            </For>
          )}
        </For>

        <Show when={!end()}>
          <div
            // @ts-ignore
            ref={setEl}
          >
          </div>
        </Show>
      </ol>
    </QueueProvider>
  );
};

const Item: Component<Item> = (item) => {
  const { audio } = item;

  const queue = use_queue();

  const handle_click = () => {
    if (queue) {
      const { replace } = queue;

      replace(item);
    }
  };

  // dprint-ignore
  const disabled = 
        audio.processing        === 1 

    ||  audio.processing_state  === 1;

  return (
    <li
      //
      class={
        // dprint-ignore
        `flex gap-4 mx-2 px-4 py-3 select-none ${disabled ? "opacity-60" : "cursor-pointer rounded transition hover:bg-zinc-900 active:bg-zinc-800"}`
      }
      //
      onClick={
        //
        disabled ? undefined : handle_click
      }
    >
      <div class="w-8 h-8 flex-none">
        {
          //
          audio.has_thumbnail
            //
            ? (
              <img
                //
                class="w-full h-full rounded"
                //
                src={`/endpoints/thumbnail?id=${audio.id}&size=64`}
                //
                alt=""
                //
                loading="lazy"
                //
                decoding="async"
              />
            )
            //
            : (
              <svg
                //
                class="w-full h-full fill-zinc-300"
                //
                viewBox="0 0 24 24"
              >
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8zm2 11h-3v3.75c0 1.24-1.01 2.25-2.25 2.25S8.5 17.99 8.5 16.75s1.01-2.25 2.25-2.25c.46 0 .89.14 1.25.38V11h4zm-3-4V3.5L18.5 9z">
                </path>
              </svg>
            )
        }
      </div>

      <div>
        <h1 class="line-clamp-1">
          {item.title ?? item.audio.file_name}
        </h1>

        <div class="line-clamp-1 text-zinc-400">
          {
            // dprint-ignore
            audio.processing === 0

              ? audio.processing_state === 1

                  ? <>Unable to process this file.</> 

                  : item.artist && <>{item.artist}</> 
              
              : item.artist 

                  ? <>{item.artist}</> 

                  : <>Processing...</>
          }
        </div>
      </div>

      {item.duration && (
        <div class="w-8 h-8 flex-none ml-auto content-center text-center text-zinc-400">
          {item.duration}
        </div>
      )}
    </li>
  );
};

export default AudioPlayer;
