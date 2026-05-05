import { Navigate, type RouteSectionProps } from "@solidjs/router";
import { Match, Switch } from "solid-js";

import { authClient } from "./lib/auth";

export default function ProtectedRoute(props: RouteSectionProps) {
  const session = authClient.useSession();

  return (
    <Switch fallback={<Navigate href="/login" />}>
      <Match when={session().isPending}>
        <p>Loading…</p>
      </Match>
      <Match when={session().data?.user}>{props.children}</Match>
    </Switch>
  );
}
