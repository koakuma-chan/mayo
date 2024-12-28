import type {
  ParentComponent,
} from "solid-js";

type Props = {
  sx: string;
};

const Button: ParentComponent<Props> = (props) => {
  return (
    <button
      //
      class={
        //
        `rounded transition bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 ${props.sx}`
          .trim()
      }
    >
      {props.children}
    </button>
  );
};

export default Button;
