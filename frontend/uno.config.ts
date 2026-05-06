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
});
