import { defineConfig, presetWind4, transformerDirectives, transformerVariantGroup } from "unocss";

import { presetAnimate } from "./uno-presets/animate";
import { presetShadcn } from "./uno-presets/shadcn";

export default defineConfig({
  presets: [
    presetWind4({
      dark: {
        dark: '[data-theme="dark"]',
        light: '[data-theme="light"]',
      },
    }),
    presetAnimate(),
    presetShadcn(),
  ],
  transformers: [transformerVariantGroup(), transformerDirectives()],
  shortcuts: {
    smallcaps: "font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground",
    chip: "px-2.5 py-1 border border-border bg-background font-mono text-[11px] text-muted-foreground cursor-pointer transition-colors duration-150 hover:(border-muted-foreground text-foreground)",
    "chip-active": "border-foreground! text-foreground bg-muted",
    "card-tile":
      "flex flex-col gap-1 border border-border bg-background px-3.5 py-3 text-left cursor-pointer transition-colors duration-150 hover:border-muted-foreground",
    "card-tile-active": "border-foreground! bg-muted",
  },
});
