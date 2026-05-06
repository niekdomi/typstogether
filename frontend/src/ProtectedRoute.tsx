import { Navigate, type RouteSectionProps } from "@solidjs/router";
import { Match, Switch } from "solid-js";

import { authClient } from "./lib/auth";

function loginRedirect(): string {
  const next = location.pathname + location.search;
  return next === "/dashboard" || next === "/"
    ? "/login"
    : `/login?next=${encodeURIComponent(next)}`;
}

export default function ProtectedRoute(props: RouteSectionProps) {
  const session = authClient.useSession();

  return (
    <Switch fallback={<Navigate href={loginRedirect()} />}>
      <Match when={session().isPending}>
        <p>Loading…</p>
      </Match>
      <Match when={session().data?.user}>{props.children}</Match>
    </Switch>
  );
}
