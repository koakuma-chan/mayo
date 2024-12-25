import type { Component } from "solid-js";

type Props = {
  checked: boolean;

  onClick?: () => void;
};

const Switch: Component<Props> = (props) => {
  return (
    <button
      //
      onClick={props.onClick}
      //
      class={
        // dprint-ignore
        `relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${props.checked ? "bg-zinc-700" : "bg-zinc-900"}`
      }
    >
      <span
        //
        class={
          // dprint-ignore
          `inline-block h-3 w-3 transform rounded-full bg-zinc-300 transition-transform ${props.checked ? "translate-x-4" : "translate-x-1"}`
        }
      />
    </button>
  );
};

export default Switch;
