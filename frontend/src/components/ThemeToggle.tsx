import { useColorMode } from "@kobalte/core/color-mode";
import { TbOutlineMoon, TbOutlineSun } from "solid-icons/tb";
import { Show } from "solid-js";

import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

// Matches the 200ms transition declared in styles.css; +10ms slack so the
// class outlives the actual paint.
const THEME_TRANSITION_MS = 210;

function toggleWithTransition(toggle: () => void) {
  const html = document.documentElement;
  html.classList.add("theme-changing");
  toggle();
  setTimeout(() => {
    html.classList.remove("theme-changing");
  }, THEME_TRANSITION_MS);
}

export default function ThemeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();
  return (
    <Tooltip openDelay={150}>
      <TooltipTrigger
        as={Button<"button">}
        variant="outline"
        size="icon"
        class="border-border/60"
        onClick={() => {
          toggleWithTransition(toggleColorMode);
        }}
      >
        <Show when={colorMode() === "dark"} fallback={<TbOutlineMoon size={14} />}>
          <TbOutlineSun size={14} />
        </Show>
      </TooltipTrigger>
      <TooltipContent>
        {colorMode() === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      </TooltipContent>
    </Tooltip>
  );
}
