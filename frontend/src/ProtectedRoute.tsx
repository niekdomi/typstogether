import { type RouteSectionProps, useNavigate } from "@solidjs/router";
import { Show, createEffect, createResource } from "solid-js";

import { baseUrl } from "./lib/api";

async function fetchSession() {
  const res = await fetch(`${baseUrl}/api/auth/get-session`, { credentials: "include" });
  return res.ok ? ((await res.json()) as { user?: unknown }) : null;
}

export default function ProtectedRoute(props: RouteSectionProps) {
  const navigate = useNavigate();
  const [session] = createResource(fetchSession);

  createEffect(() => {
    if (session.loading) return;
    if (session.error || !session()?.user) {
      navigate("/login", { replace: true });
    }
  });

  return (
    <Show when={!session.loading && !session.error && session()?.user}>
      {props.children}
    </Show>
  );
}
