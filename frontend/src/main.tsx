import { ColorModeProvider, ColorModeScript } from "@kobalte/core/color-mode";
import { render } from "solid-js/web";

import App from "./App";

import "./styles.css";

// Kobalte's ColorModeProvider flips `data-kb-theme` on <html> but offers no
// hook for the change event. Watch the attribute and add `.theme-fade` for
// 200ms so the cross-theme color transition only runs during the flip — not
// on every background-color change throughout the app.
{
  const root = document.documentElement;
  let timer: ReturnType<typeof setTimeout> | undefined;
  new MutationObserver(() => {
    root.classList.add("theme-fade");
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      root.classList.remove("theme-fade");
    }, 200);
  }).observe(root, { attributes: true, attributeFilter: ["data-kb-theme"] });
}

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
