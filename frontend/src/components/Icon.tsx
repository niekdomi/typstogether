import { Match, Switch } from "solid-js";

// Widen union with `(string & {})` so adding new variants later doesn't trip
// `no-unnecessary-condition` while we have only one.
type IconName = "info" | (string & {});

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
}

export default function Icon(props: IconProps) {
  const size = () => props.size ?? 14;
  const stroke = () => props.stroke ?? 1.4;

  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width={stroke()}
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <Switch>
        <Match when={props.name === "info"}>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 7v4M8 5v.1" />
        </Match>
      </Switch>
    </svg>
  );
}
