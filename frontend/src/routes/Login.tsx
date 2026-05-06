import { For, Show, createResource, createSignal } from "solid-js";

import Logomark from "../components/Logomark";
import ProviderGlyph from "../components/ProviderGlyph";
import { api } from "../lib/api";
import { authClient } from "../lib/auth";

async function loadProviders() {
  const { data } = await api.auth.providers.get();
  return data ?? [];
}

export default function Login() {
  const [providers] = createResource(loadProviders);
  const [submitting, setSubmitting] = createSignal<string | null>(null);

  async function signIn(provider: string) {
    setSubmitting(provider);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: location.origin + "/dashboard",
    });
    if (error) {
      console.error("Sign-in failed:", error);
      setSubmitting(null);
    }
  }

  return (
    <div class="fade-in login-root">
      <aside class="login-hero">
        <Logomark size={20} />
        <div class="login-hero-copy">
          <h1>
            Typst, but <span class="login-hero-accent">together.</span>
          </h1>
          <p>A collaborative editor for Typst documents.</p>
        </div>
      </aside>

      <section class="login-form-wrap">
        <div class="login-form">
          <h2 class="display login-form-title">Sign in.</h2>
          <p class="login-form-sub">Pick a provider (OAuth only).</p>

          <Show
            when={!providers.loading}
            fallback={<p class="login-loading">Loading providers…</p>}
          >
            <div class="login-provider-list">
              <For each={providers() ?? []}>
                {(p) => (
                  <button
                    type="button"
                    class={
                      p.id === "github" ? "btn btn-primary login-provider" : "btn login-provider"
                    }
                    onClick={() => void signIn(p.id)}
                    disabled={submitting() !== null}
                  >
                    <ProviderGlyph name={p.id} />
                    <span class="login-provider-label">
                      {submitting() === p.id ? "Authenticating…" : `Continue with ${p.name}`}
                    </span>
                    <span class="mono login-provider-tag">oauth</span>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </section>
    </div>
  );
}
