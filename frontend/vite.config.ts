import { svelte } from "@sveltejs/vite-plugin-svelte";
import { router } from "sv-router/vite-plugin";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  base: process.env["VITE_BASE_URL"] ?? "/",
  plugins: [svelte(), wasm(), router()],
  build: {
    target: "esnext",
  },
});
