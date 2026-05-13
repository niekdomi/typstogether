import { Navigate, type RouteSectionProps, useLocation } from "@solidjs/router";
import { Match, Switch } from "solid-js";

import { authClient } from "./lib/auth";
import { CurrentUserProvider } from "./lib/CurrentUserContext";

export default function ProtectedRoute(props: RouteSectionProps) {
  const session = authClient.useSession();
  const location = useLocation();

  const loginHref = () => {
    const next = location.pathname + location.search;
    return next === "/dashboard" || next === "/"
      ? "/login"
      : `/login?next=${encodeURIComponent(next)}`;
  };

  return (
    <Switch fallback={<Navigate href={loginHref()} />}>
      <Match when={session().isPending}>
        <p>Loading…</p>
      </Match>
      <Match when={session().data?.user}>
        {(user) => <CurrentUserProvider user={user()}>{props.children}</CurrentUserProvider>}
      </Match>
    </Switch>
  );
}
