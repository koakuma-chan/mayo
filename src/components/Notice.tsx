import type {
  ParentComponent,
} from "solid-js";

const Notice: ParentComponent = (props) => {
  return (
    <div class="p-2 text-center text-zinc-500">
      {props.children}
    </div>
  );
};

export default Notice;
