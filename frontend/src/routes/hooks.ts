import type { Hooks } from "sv-router";
import { navigate } from "sv-router/generated";

export default {
  beforeLoad() {
    throw navigate("/dashboard", { replace: true });
  },
} satisfies Hooks;
