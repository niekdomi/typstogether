import { For, createResource } from "solid-js";

import { api } from "../lib/api";
import { authClient } from "../lib/auth";

async function loadProviders() {
  const { data } = await api.auth.providers.get();
  return data ?? [];
}

async function signIn(provider: string) {
  const { error } = await authClient.signIn.social({
    provider,
    callbackURL: location.origin + "/dashboard",
  });
  if (error) console.error("Sign-in failed:", error);
}

export default function Login() {
  const [providers] = createResource(loadProviders);

  return (
    <main>
      <h1>Sign in to Typstogether</h1>
      <For each={providers.latest ?? []}>
        {(p) => (
          <button type="button" onClick={() => void signIn(p.id)}>
            Continue with {p.name}
          </button>
        )}
      </For>
    </main>
  );
}
