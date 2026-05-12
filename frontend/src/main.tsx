import { render } from "solid-js/web";

import App from "./App";
import { ThemeProvider } from "./lib/ThemeContext";

import "./styles.css";

render(
  () => (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  ),
  document.querySelector("#app")!
);
