import type { ProviderId } from "@typstogether/backend";
import { SiGithub, SiGitlab, SiGoogle } from "solid-icons/si";
import { Match, Switch } from "solid-js";

interface ProviderGlyphProps {
  name: ProviderId;
  size?: number;
}

export default function ProviderGlyph(props: ProviderGlyphProps) {
  const size = () => props.size ?? 18;

  return (
    <Switch>
      <Match when={props.name === "github"}>
        <SiGithub size={size()} />
      </Match>
      <Match when={props.name === "gitlab"}>
        <SiGitlab size={size()} />
      </Match>
      <Match when={props.name === "google"}>
        <SiGoogle size={size()} />
      </Match>
    </Switch>
  );
}
