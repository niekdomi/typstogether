import { ColorModeProvider, ColorModeScript } from "@kobalte/core/color-mode";
import { render } from "solid-js/web";

import App from "./App";

import "./styles.css";

render(
  () => (
    <>
      <ColorModeScript />
      <ColorModeProvider disableTransitionOnChange={false}>
        <App />
      </ColorModeProvider>
    </>
  ),
  document.querySelector("#app")!
);
