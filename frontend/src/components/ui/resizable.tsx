import ResizablePrimitive from "corvu/resizable";
import { type ComponentProps, splitProps } from "solid-js";

import { cx } from "./cva";

export function Resizable(props: ComponentProps<typeof ResizablePrimitive>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <ResizablePrimitive
      class={cx("flex size-full data-[orientation=vertical]:flex-col", local.class)}
      {...rest}
    />
  );
}

export const ResizablePanel = ResizablePrimitive.Panel;

export function ResizableHandle(props: ComponentProps<typeof ResizablePrimitive.Handle>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <ResizablePrimitive.Handle
      class={cx(
        "bg-border/60 hover:bg-primary/50 data-[dragging]:bg-primary focus-visible:bg-primary relative flex shrink-0 items-stretch outline-none transition-colors",
        "w-px data-[orientation=horizontal]:cursor-col-resize",
        "data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:cursor-row-resize",
        // Widen the pointer hit target without taking up layout space.
        "after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2",
        "data-[orientation=vertical]:after:inset-x-0 data-[orientation=vertical]:after:top-1/2 data-[orientation=vertical]:after:h-2 data-[orientation=vertical]:after:w-full data-[orientation=vertical]:after:-translate-y-1/2",
        local.class
      )}
      {...rest}
    />
  );
}
