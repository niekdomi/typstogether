<script lang="ts">
  import { api, baseUrl } from "../lib/api";

  let providers = $state<{ id: string; name: string }[]>([]);

  async function loadProviders() {
    const { data } = await api.auth.providers.get();
    if (data) {
      providers = data;
    }
  }

  $effect(() => void loadProviders());

  async function signIn(provider: string) {
    const res = await fetch(`${baseUrl}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ provider, callbackURL: globalThis.location.origin + "/dashboard" }),
    });
    const { url } = (await res.json()) as { url: string };
    globalThis.location.href = url;
  }
</script>

<main>
  <h1>Sign in to Typstogether</h1>
  {#each providers as provider (provider.id)}
    <button onclick={() => signIn(provider.id)}>Continue with {provider.name}</button>
  {/each}
</main>
