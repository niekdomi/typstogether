import { Navigate, type RouteSectionProps } from "@solidjs/router";
import { Match, Switch } from "solid-js";

import { authClient } from "./lib/auth";
import { CurrentUserProvider } from "./lib/CurrentUserContext";

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
      <Match when={session().data?.user}>
        {(user) => <CurrentUserProvider user={user()}>{props.children}</CurrentUserProvider>}
      </Match>
    </Switch>
  );
}
