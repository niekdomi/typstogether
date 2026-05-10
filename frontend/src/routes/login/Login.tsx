import { Navigate } from "@solidjs/router";
import { For, Match, Show, Switch, createResource, createSignal } from "solid-js";

import Logo from "../../components/Logo";
import { Button } from "../../components/ui/button";
import { api } from "../../lib/api";
import { authClient } from "../../lib/auth";
import ProviderGlyph from "./ProviderGlyph";

async function loadProviders() {
  const { data } = await api.auth.providers.get();
  return data ?? [];
}

function readNextParam(): string {
  const next = new URLSearchParams(location.search).get("next");
  return next?.startsWith("/") ? next : "/dashboard";
}

export default function Login() {
  const session = authClient.useSession();
  const [providers] = createResource(loadProviders);
  const [submitting, setSubmitting] = createSignal<string | null>(null);
  const safeNext = readNextParam();

  async function signIn(provider: string) {
    setSubmitting(provider);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: location.origin + safeNext,
    });
    if (error) {
      console.error("Sign-in failed:", error);
      setSubmitting(null);
    }
  }

  return (
    <Switch
      fallback={
        <div class="grid min-h-screen grid-cols-[1.05fr_1fr] bg-background">
          <aside class="flex flex-col gap-6 overflow-hidden border-r border-border bg-muted px-12 py-8">
            <Logo size={20} />
            <div class="my-auto max-w-130">
              <h1 class="mb-4.5 text-[54px] font-medium leading-[1.02] tracking-tight">
                Typst, but <span class="italic text-brand">together.</span>
              </h1>
              <p class="max-w-115 text-base leading-normal text-foreground/75">
                A collaborative editor for Typst documents.
              </p>
            </div>
          </aside>

          <section class="flex items-center justify-center p-10">
            <div class="w-full max-w-90">
              <h2 class="mb-1.5 text-[32px] font-medium tracking-[-0.01em]">Sign in</h2>

              <Show
                when={!providers.loading}
                fallback={<p class="text-sm text-muted-foreground">Loading providers…</p>}
              >
                <div class="grid gap-2.5">
                  <For each={providers() ?? []}>
                    {(p) => (
                      <Button
                        variant="outline"
                        class="justify-start gap-3.5 px-4.5 py-3.5 text-[15px] h-auto disabled:opacity-70 disabled:cursor-not-allowed"
                        onClick={() => void signIn(p.id)}
                        disabled={submitting() !== null}
                      >
                        <ProviderGlyph name={p.id} />
                        <span class="flex-1 text-left">
                          {submitting() === p.id ? "Authenticating…" : `Continue with ${p.name}`}
                        </span>
                        <span class="mono text-xs text-muted-foreground">oauth</span>
                      </Button>
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
        <p class="text-sm text-muted-foreground">Loading…</p>
      </Match>
      <Match when={session().data?.user}>
        <Navigate href={safeNext} />
      </Match>
    </Switch>
  );
}
