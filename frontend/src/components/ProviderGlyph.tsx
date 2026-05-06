import { SiGithub, SiGitlab, SiGoogle } from "solid-icons/si";
import { Match, Switch } from "solid-js";

type ProviderName = "github" | "gitlab" | "google";

interface ProviderGlyphProps {
  name: ProviderName;
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
