import { Navigate, type RouteSectionProps } from "@solidjs/router";
import { Show } from "solid-js";

import { authClient } from "./lib/auth";

export default function ProtectedRoute(props: RouteSectionProps) {
  const session = authClient.useSession();

  return (
    <Show when={!session().isPending} fallback={<p>Loading…</p>}>
      <Show when={session().data?.user} fallback={<Navigate href="/login" />}>
        {props.children}
      </Show>
    </Show>
  );
}
