import type { JSX } from "solid-js";

import { cx } from "../../components/ui/cva";

interface Props {
  open: boolean;
  children: JSX.Element;
}

export default function WorkspacePanel(props: Props) {
  return (
    <div
      class={cx(
        "shrink-0 overflow-hidden bg-sidebar transition-[width] duration-200 ease-linear",
        props.open ? "w-64 border-r border-sidebar-border" : "w-0"
      )}
    >
      <div class="h-full w-64">{props.children}</div>
    </div>
  );
}
