import { type RouteSectionProps, useNavigate } from "@solidjs/router";
import { Show, createEffect } from "solid-js";

import { authClient } from "./lib/auth";

export default function ProtectedRoute(props: RouteSectionProps) {
  const navigate = useNavigate();
  const session = authClient.useSession();

  createEffect(() => {
    const s = session();
    if (s.isPending) return;
    if (s.error || !s.data?.user) {
      navigate("/login", { replace: true });
    }
  });

  return <Show when={session().data?.user}>{props.children}</Show>;
}
