import { For, createResource } from "solid-js";

import { api, baseUrl } from "../lib/api";

async function loadProviders() {
  const { data } = await api.auth.providers.get();
  return data ?? [];
}

async function signIn(provider: string) {
  const res = await fetch(`${baseUrl}/api/auth/sign-in/social`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ provider, callbackURL: location.origin + "/dashboard" }),
  });
  const { url } = (await res.json()) as { url: string };
  location.href = url;
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
