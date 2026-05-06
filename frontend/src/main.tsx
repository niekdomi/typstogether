import { render } from "solid-js/web";

import App from "./App";

import "virtual:uno.css";
import "./styles.css";

render(() => <App />, document.querySelector("#app")!);
