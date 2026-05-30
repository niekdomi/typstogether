import { Switch as SwitchPrimitive } from "@kobalte/core/switch";
import type { ComponentProps, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cx } from "./cva";

export type SwitchProps<T extends ValidComponent = "label"> = ComponentProps<
  typeof SwitchPrimitive<T>
>;

export const Switch = <T extends ValidComponent = "label">(props: SwitchProps<T>) => {
  const [local, rest] = splitProps(props as SwitchProps, ["class", "children"]);
  return (
    <SwitchPrimitive data-slot="switch" class={cx("items-center", local.class)} {...rest}>
      <SwitchPrimitive.Input class="peer sr-only" />
      {local.children}
      <SwitchPrimitive.Control
        class={cx(
          "bg-input data-[checked]:bg-primary inline-flex h-5 w-9 cursor-pointer items-center rounded-full border-2 border-transparent",
          "transition-colors outline-none",
          "peer-focus-visible:ring-ring peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
        )}
      >
        <SwitchPrimitive.Thumb
          class={cx(
            "bg-background pointer-events-none block size-4 rounded-full shadow ring-0",
            "translate-x-0 transition-transform data-[checked]:translate-x-4"
          )}
        />
      </SwitchPrimitive.Control>
    </SwitchPrimitive>
  );
};
