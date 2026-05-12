import { useNavigate } from "@solidjs/router";
import { createContext, type JSX, useContext } from "solid-js";

import { authClient } from "./auth";

type Session = ReturnType<ReturnType<typeof authClient.useSession>>;
export type CurrentUser = NonNullable<Session["data"]>["user"];

interface CurrentUserContextValue {
  readonly user: CurrentUser;
}

const CurrentUserContext = createContext<CurrentUserContextValue>();

export function CurrentUserProvider(props: { user: CurrentUser; children: JSX.Element }) {
  const value: CurrentUserContextValue = {
    get user() {
      return props.user;
    },
  };
  return <CurrentUserContext.Provider value={value}>{props.children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserContextValue {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error("useCurrentUser must be used inside CurrentUserProvider");
  return ctx;
}

export function useSignOut() {
  const navigate = useNavigate();
  return async () => {
    await authClient.signOut();
    navigate("/login");
  };
}
