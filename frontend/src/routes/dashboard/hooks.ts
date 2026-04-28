import type { Hooks } from "sv-router";
import { navigate } from "sv-router/generated";

export default {
  async beforeLoad() {
    const session = null; // TODO: Check for better-auth
    if (!session) {
      throw navigate("/login");
    }
  },
} satisfies Hooks;
