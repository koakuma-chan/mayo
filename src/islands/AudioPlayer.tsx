// dprint-ignore
import { 
  actions
}               from "astro:actions";

// dprint-ignore
import { 
  type Component,

  createEffect, 

  createSignal,

  For,

  onCleanup,

  onMount,

  Show
}               from "solid-js";

// dprint-ignore
import { 
  createContextProvider
}               from "@solid-primitives/context";

// dprint-ignore
import { 
  makeAudioPlayer
}               from "@solid-primitives/audio";

// dprint-ignore
import { 
  createInfiniteScroll
}               from "@solid-primitives/pagination";

// dprint-ignore
import { 
  makeEventListener
}               from "@solid-primitives/event-listener";

// dprint-ignore
import type { 
  Item
}               from "@/actions/audio";

// dprint-ignore
import FadeIn   from "@/components/FadeIn";

const parse_tags = (tags: string) =>
  Object
    //
    .fromEntries(
      //
      (JSON.parse(tags) as Array<Array<string>>)
        //
        .map(
          //
          ([key, value]) => [key.toLowerCase(), value],
        ),
    );

const [
  QueueProvider,

  use_queue,
] = createContextProvider(() => {
  const [
    playing,

    set_playing,
  ] = createSignal<
    //
    Item | null
  >(null);

  createEffect((previous: ReturnType<typeof makeAudioPlayer> | undefined) => {
    const current = playing();

    if (current !== null) {
      if (previous) {
        previous.pause();
      }

      const player = makeAudioPlayer(`/endpoints/audio?id=${current.id}`);

      player.play();

      if ("mediaSession" in navigator) {
        const tags = parse_tags(current.tags!);

        // dprint-ignore
        navigator.mediaSession.metadata = new MediaMetadata({

          title   : tags["title"],

          artist  : tags["artist"],

          album   : tags["album"],

          artwork : current.has_thumbnail
            ? 
              [
                {
                  src: `/endpoints/thumbnail?id=${current.id}&size=64`,

                  sizes: "64x64",
                },

                {
                  src: `/endpoints/thumbnail?id=${current.id}&size=128`,

                  sizes: "128x128",
                },

                {
                  src: `/endpoints/thumbnail?id=${current.id}&size=256`,

                  sizes: "256x256",
                },

                {
                  src: `/endpoints/thumbnail?id=${current.id}&size=512`,

                  sizes: "512x512",
                },
              ]
            :
              [],
        });
      }

      return player;
    }
  });

  const replace = (item: Item) => {
    set_playing(item);
  };

  return { replace };
});

const AudioPlayer: Component = () => {
  const [
    pages,

    setEl,

    {
      end,

      setPages,
    },
  ] = createInfiniteScroll(async (page) => {
    const items = await actions.audio.get_page.orThrow(page);

    return [{ animate: true, items }];
  });

  onMount(() => {
    const handleSwap = async () => {
      const items = await actions.audio.get_page.orThrow(0);

      setPages([{ animate: true, items }]);
    };

    makeEventListener(document, "astro:after-swap", handleSwap, { passive: true });
  });

  const timers = new Map();

  onCleanup(() => {
    for (const timer of timers.values()) {
      clearInterval(timer);
    }
  });

  createEffect(() => {
    pages()
      //
      .flatMap(
        ({ items }) => items,
      )
      //
      .filter(
        item => item.processing === 1 && timers.has(item.id) === false,
      )
      //
      .forEach(
        item => {
          const timer = setInterval(async () => {
            const fresh = await actions.audio.get_one.orThrow(item.id);

            if (fresh === null || fresh.processing === 0) {
              clearInterval(timer);

              timers.delete(item.id);
            }

            if (fresh === null) {
              setPages(pages =>
                pages.map(page => {
                  const items = page.items.filter(previous => item.id !== previous.id);

                  return { animate: false, items };
                })
              );
            } else {
              if (fresh.processing !== item.processing || fresh.processing_state !== item.processing_state) {
                setPages(pages =>
                  pages.map(page => {
                    const items = page.items.map(previous => previous.id === item.id ? fresh : previous);

                    return { animate: false, items };
                  })
                );
              }
            }
          }, 1000);

          timers.set(item.id, timer);
        },
      );
  });

  return (
    <ol class="grid gap-1">
      <QueueProvider>
        <For each={pages()}>
          {({
            animate,

            items,
          }) => (
            <For each={items}>
              {(item, index) =>
                // dprint-ignore
                animate
                //
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
                //
                : (
                  <>
                    <Item {...item} />
                  </>
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
      </QueueProvider>
    </ol>
  );
};

const Item: Component<Item> = (props) => {
  const queue = use_queue();

  const handle_click = () => {
    if (queue) {
      const { replace } = queue;

      replace(props);
    }
  };

  // dprint-ignore
  let 

    label   : string          = props.file_name,

    artist  : string | null   = null;

  if (props.tags) {
    const tags = parse_tags(props.tags);

    artist = tags["artist"];

    const title = tags["title"];

    if (title) {
      label = title;
    }
  }

  const format_duration = (seconds: number) => {
    // dprint-ignore
    const 

      hours             = Math.floor(seconds / 3600),

      minutes           = Math.floor((seconds % 3600) / 60),

      remaining_seconds = seconds % 60;

    let result;

    // dprint-ignore
    const pad           = (num: number) => String(num).padStart(2, "0");

    if (hours > 0) {
      result = `
        ${pad(hours)}
        :
        ${pad(minutes)}
        :
        ${pad(remaining_seconds)}
      `;
    } else {
      result = `
        ${pad(minutes)}
        :
        ${pad(remaining_seconds)}
      `;
    }

    return result
      //
      .replace(/\s+/g, "");
  };

  return (
    <li
      //
      class={
        // dprint-ignore
        `flex gap-4 mx-2 px-4 py-3 select-none ${(props.processing === 0 && props.processing_state !== 1) ? "cursor-pointer rounded transition hover:bg-zinc-900 active:bg-zinc-800" : "opacity-80"}`
          //
          .trim()
      }
      //
      onClick={handle_click}
    >
      <div class="w-8 h-8 flex-none">
        {
          //
          props.has_thumbnail
            //
            ? (
              <img
                //
                class="w-full h-full rounded"
                //
                src={`/endpoints/thumbnail?id=${props.id}&size=64`}
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
          {label}
        </h1>

        <div class="line-clamp-1 text-zinc-400">
          {
            // dprint-ignore
            props.processing === 0 

              && props.processing_state === 1

                ? <>Unable to process this file.</>

                : artist ? <>{artist}</> : <>Processing</>
          }
        </div>
      </div>

      {props.duration && (
        <div class="w-8 h-8 flex-none ml-auto content-center text-center text-zinc-400">
          {format_duration(props.duration)}
        </div>
      )}
    </li>
  );
};

export default AudioPlayer;
