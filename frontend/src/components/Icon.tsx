import { TbOutlineInfoCircle } from "solid-icons/tb";
import { Match, Switch } from "solid-js";

type IconName = "info" | (string & {});

interface IconProps {
  name: IconName;
  size?: number;
}

export default function Icon(props: IconProps) {
  const size = () => props.size ?? 14;

  return (
    <Switch>
      <Match when={props.name === "info"}>
        <TbOutlineInfoCircle size={size()} />
      </Match>
    </Switch>
  );
}
