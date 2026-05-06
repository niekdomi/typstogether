import { Navigate } from "@solidjs/router";
import { For, Match, Show, Switch, createResource, createSignal } from "solid-js";

import Logomark from "../components/Logomark";
import ProviderGlyph from "../components/ProviderGlyph";
import { api } from "../lib/api";
import { authClient } from "../lib/auth";

import "./Login.css";

async function loadProviders() {
  const { data } = await api.auth.providers.get();
  return data ?? [];
}

export default function Login() {
  const session = authClient.useSession();
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
    <Switch
      fallback={
        <div class="fade-in login">
          <aside class="hero">
            <Logomark size={20} />
            <div class="hero-copy">
              <h1>
                Typst, but <span class="hero-accent">together.</span>
              </h1>
              <p>A collaborative editor for Typst documents.</p>
            </div>
          </aside>

          <section class="form-wrap">
            <div class="form">
              <h2 class="display form-title">Sign in.</h2>
              <p class="form-sub">Pick a provider (OAuth only).</p>

              <Show when={!providers.loading} fallback={<p class="loading">Loading providers…</p>}>
                <div class="provider-list">
                  <For each={providers() ?? []}>
                    {(p) => (
                      <button
                        type="button"
                        class="btn provider"
                        onClick={() => void signIn(p.id)}
                        disabled={submitting() !== null}
                      >
                        <ProviderGlyph name={p.id} />
                        <span class="provider-label">
                          {submitting() === p.id ? "Authenticating…" : `Continue with ${p.name}`}
                        </span>
                        <span class="mono provider-tag">oauth</span>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </section>
        </div>
      }
    >
      <Match when={session().isPending}>
        <p class="loading">Loading…</p>
      </Match>
      <Match when={session().data?.user}>
        <Navigate href="/dashboard" />
      </Match>
    </Switch>
  );
}
