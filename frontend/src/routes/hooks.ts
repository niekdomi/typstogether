import type { Hooks } from "sv-router";
import { navigate } from "sv-router/generated";

export default {
  beforeLoad() {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw navigate("/dashboard", { replace: true });
  },
} satisfies Hooks;
