import unocss from "unocss/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  base: process.env["VITE_BASE_URL"] ?? "/",
  plugins: [unocss(), solidPlugin(), wasm()],
  build: {
    target: "esnext",
  },
});
