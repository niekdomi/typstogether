import type { ProviderId } from "@typstogether/backend";
import type { IconTypes } from "solid-icons";
import { SiGithub, SiGitlab, SiGoogle } from "solid-icons/si";
import { Dynamic } from "solid-js/web";

const icons: Record<ProviderId, IconTypes> = {
  github: SiGithub,
  gitlab: SiGitlab,
  google: SiGoogle,
};

interface ProviderGlyphProps {
  name: ProviderId;
  size?: number;
}

export default function ProviderGlyph(props: ProviderGlyphProps) {
  return <Dynamic component={icons[props.name]} size={props.size ?? 18} />;
}
