import {
  actions,
} from "astro:actions";

import {
  type Component,
  createEffect,
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import {
  makeAudioPlayer,
} from "@solid-primitives/audio";

import {
  createContextProvider,
  MultiProvider,
} from "@solid-primitives/context";

import {
  makeEventListener,
} from "@solid-primitives/event-listener";

import {
  createInfiniteScroll,
} from "@solid-primitives/pagination";

import Hammer from "hammerjs";

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
  ContextMenuProvider,

  use_context_menu,
] = createContextProvider(() => {
  const [
    open,

    set_open,
  ] = createSignal(
    false,
  );

  const [
    position,

    set_position,
  ] = createSignal(
    { x: 0, y: 0 },
  );

  const [
    item,

    set_item,
  ] = createSignal<Item | undefined>(
    undefined,
  );

  let dialog_ref: HTMLDialogElement | undefined;

  createEffect(() => {
    const is_open = open();

    if (dialog_ref) {
      if (is_open) {
        dialog_ref.showModal();
      } else {
        dialog_ref.close();
      }
    }
  });

  createEffect(() => {
    const { x, y } = position();

    if (dialog_ref) {
      dialog_ref.style.left = `${x}px`;

      dialog_ref.style.top = `${y}px`;
    }
  });

  onMount(() => {
    const handle_click = (e: MouseEvent) => {
      if (dialog_ref) {
        const rect = dialog_ref.getBoundingClientRect();

        // dprint-ignore
        if (rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width) {
          return;
        }

        set_open(false);
      }
    };

    makeEventListener(document, "click", handle_click, { passive: true });
  });

  const queue = use_definite_queue();

  const controls = [
    {
      handle_click: () => {
        const current_item = item();

        if (current_item) {
          queue.push_next(current_item);

          set_open(false);
        }
      },

      label: "Play next",

      icon: <path d="M3 10h11v2H3zm0-4h11v2H3zm0 8h7v2H3zm13-1v8l6-4z"></path>,
    },

    {
      handle_click: () => {
        const current_item = item();

        if (current_item) {
          queue.push(current_item);

          set_open(false);
        }
      },

      label: "Add to queue",

      icon: (
        <path d="M15 6H3v2h12zm0 4H3v2h12zM3 16h8v-2H3zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6z">
        </path>
      ),
    },

    {
      handle_click: () => {},

      label: "Download",

      icon: <path d="M19 9h-4V3H9v6H5l7 7zM5 18v2h14v-2z"></path>,
    },
  ];

  const el = (
    <dialog
      //
      class="truncate backdrop:bg-transparent bg-transparent outline-none text-inherit backdrop-blur-sm rounded transition opacity-0 open:opacity-100 starting:open:opacity-0"
      //
      ref={dialog_ref}
    >
      <menu class="divide-y divide-zinc-900">
        <For each={controls}>
          {item => (
            <li>
              <button
                //
                class="p-3 flex gap-2 items-center outline-none select-none cursor-pointer transition hover:brightness-125"
                //
                on:click={item.handle_click}
              >
                <svg
                  //
                  class="w-5 h-5 fill-zinc-300"
                  //
                  viewBox="0 0 24 24"
                >
                  {item.icon}
                </svg>

                {item.label}
              </button>
            </li>
          )}
        </For>
      </menu>
    </dialog>
  );

  return {
    open,

    set_open,

    position,

    set_position,

    item,

    set_item,

    el,
  };
});

const use_definite_context_menu = () => use_context_menu()!;

const [
  QueueProvider,

  use_queue,
] = createContextProvider(() => {
  const [
    current,

    set_current,
  ] = createSignal(
    -1,
  );

  const queue = new Array();

  createEffect(() => {
    const item = queue[current()];

    if (item) {
      const player = makeAudioPlayer(`/endpoints/audio?id=${item.audio.id}`, {
        ended: () => {
          const current_index = current();

          if (current_index < queue.length - 1) {
            play_next();
          }
        },
      });

      player.play();

      onCleanup(() => player.pause());

      const session = navigator.mediaSession;

      if (session) {
        const artwork = item.audio.has_thumbnail
          //
          ? ["512", "384", "256", "128", "64"]
            .map(size => {
              return {
                src: `/endpoints/thumbnail?id=${item.audio.id}&size=${size}`,

                sizes: `${size}x${size}`,
              };
            })
          //
          : [];

        // dprint-ignore
        session.metadata = new MediaMetadata({
          title   : item.title ?? item.audio.file_name,

          artist  : item.artist,

          album   : item.album,

          artwork : artwork,
        });
      }
    }
  });

  const push =
    //
    (item: Item) => queue.push(item);

  const push_next =
    //
    (item: Item) => queue.splice(current() + 1, 0, item);

  const wrap =
    //
    (i: number) => ((i % queue.length) + queue.length) % queue.length;

  const play_next =
    //
    () => set_current(current => wrap(current + 1));

  const play_previous =
    //
    () => set_current(current => wrap(current - 1));

  onMount(() => {
    const session = navigator.mediaSession;

    if (session) {
      session.setActionHandler(
        //
        "nexttrack",
        //
        play_next,
      );

      session.setActionHandler(
        //
        "previoustrack",
        //
        play_previous,
      );
    }
  });

  return {
    push,

    push_next,

    play_next,

    play_previous,
  };
});

const use_definite_queue = () => use_queue()!;

const AudioPlayer: Component = () => (
  <MultiProvider
    values={[
      QueueProvider,

      ContextMenuProvider,
    ]}
  >
    <List />
  </MultiProvider>
);

const List: Component = () => {
  const [
    fetcher,

    set_fetcher,
  ] = createSignal(
    make_fetcher(
      fetcher_strategy_network,
    ),
  );

  // dprint-ignore
  type page_maybe_fade_in = {
    fade_in : boolean ;

    page    : Item[]  ;
  };

  const fetch_page_maybe_fade_in = //
    async (index: number): Promise<
      page_maybe_fade_in[]
    > => {
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
  ] = createInfiniteScroll<
    page_maybe_fade_in
  >(
    fetch_page_maybe_fade_in,
  );

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

  const context_menu = use_definite_context_menu();

  return (
    <>
      <ol class="grid gap-1">
        <For each={pages()}>
          {({
            fade_in,

            page,
          }) => (
            <For each={page}>
              {(
                //
                item,
                //
                index,
              ) => {
                // dprint-ignore
                const Wrapper = fade_in

                  ? ({ children }: { children: JSX.Element }) => 

                      <FadeIn duration={750} delay={index() * 25}>
                        {children}
                      </FadeIn>

                  : ({ children }: { children: JSX.Element }) => 

                      <>
                        {children}
                      </>

                return (
                  <Wrapper>
                    <Item {...item} />
                  </Wrapper>
                );
              }}
            </For>
          )}
        </For>

        <Show when={!end()}>
          <div
            // @ts-ignore
            ref={setEl}
          />
        </Show>
      </ol>

      {context_menu.el}
    </>
  );
};

const Item: Component<Item> = (item) => {
  const { audio } = item;

  // dprint-ignore
  const disabled = 

        audio.processing        === 1 

    ||  audio.processing_state  === 1;

  // dprint-ignore
  const 

    queue         = use_definite_queue(),

    context_menu  = use_definite_context_menu();

  const handle_click =
    //
    () => {
      queue.push_next(item);

      queue.play_next();
    };

  const open_context_menu =
    //
    (
      position: { x: number; y: number },
    ) => {
      context_menu.set_item(item);

      context_menu.set_position(position);

      context_menu.set_open(true);
    };
  const handle_ref =
    //
    (
      ref: HTMLLIElement,
    ) => {
      const hammer = new Hammer(ref, {
        inputClass: Hammer.TouchInput,
      });

      onCleanup(() => hammer.destroy());

      hammer.on("press", e => open_context_menu(e.center));
    };

  const handle_context_menu = (
    //
    e: MouseEvent,
  ) => {
    e.preventDefault();

    open_context_menu({
      x: e.clientX,

      y: e.clientY,
    });
  };

  return (
    <li
      // dprint-ignore
      class={
        //
        `flex gap-4 mx-2 px-4 py-3 select-none ${disabled ? "opacity-60" : "cursor-pointer rounded transition hover:bg-zinc-900 active:bg-zinc-800"}`}
      //
      on:click={
        //
        disabled ? undefined : handle_click
      }
      //
      on:contextmenu={
        //
        disabled ? undefined : handle_context_menu
      }
      //
      ref={
        //
        disabled ? undefined : handle_ref
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
        <div class="w-8 h-8 flex-none ml-auto text-zinc-400 content-center text-center">
          {item.duration}
        </div>
      )}
    </li>
  );
};

export default AudioPlayer;
