import {
  type Component,
  type JSX,
  splitProps,
} from "solid-js";

type Props = {
  sx: string;
} & JSX.InputHTMLAttributes<HTMLInputElement>;

const Input: Component<Props> = (props) => {
  const [local, others] = splitProps(props, ["sx"]);

  return (
    <input
      //
      class={
        //
        `px-2 rounded bg-transparent border-2 border-zinc-900 placeholder:text-zinc-800 outline-none focus:outline-zinc-800 ${local.sx}`
          .trim()
      }
      {...others}
    />
  );
};

export default Input;
