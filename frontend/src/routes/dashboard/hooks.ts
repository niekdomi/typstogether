import type { Hooks } from "sv-router";
import { navigate } from "sv-router/generated";

import { baseUrl } from "../../lib/api";

export default {
  async beforeLoad() {
    const res = await fetch(`${baseUrl}/api/auth/get-session`, { credentials: "include" });
    const session = res.ok ? ((await res.json()) as { user?: unknown }) : null;
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    if (!session?.user) throw navigate("/login");
  },
} satisfies Hooks;
