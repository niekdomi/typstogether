import { createMemo, For, Show } from "solid-js";

import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { userColor } from "../../lib/collab/awareness-colors";
import { useRemoteAwareness } from "../../lib/collab/use-awareness";
import { useCurrentUser } from "../../lib/CurrentUserContext";
import { userInitial } from "../../lib/format";
import { useProjectContext } from "./ProjectContext";

const MAX_REMOTE = 4;

interface AvatarPillProps {
  name: string;
  image: string | null;
  color: string;
  label: string;
}

function AvatarPill(props: AvatarPillProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        as="span"
        class="ring-background -ml-1.5 block rounded-full ring-2 first:ml-0"
      >
        <Avatar class="size-7">
          <AvatarImage src={props.image ?? undefined} alt={props.name} />
          <AvatarFallback
            class="text-[11px] text-white"
            style={{ "background-color": props.color }}
          >
            {userInitial(props.name)}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>{props.label}</TooltipContent>
    </Tooltip>
  );
}

export default function CollaboratorAvatars() {
  const ctx = useProjectContext();
  const { user } = useCurrentUser();
  const remote = useRemoteAwareness(() => ctx.collab.awareness);

  const visible = createMemo(() => remote().slice(0, MAX_REMOTE));
  const overflow = createMemo(() => Math.max(0, remote().length - MAX_REMOTE));
  const selfColor = createMemo(() => userColor(user.id).color);

  return (
    <Show when={remote().length > 0}>
      <div class="flex items-center">
        <For each={visible()}>
          {(u) => <AvatarPill name={u.name} image={u.image} color={u.color} label={u.name} />}
        </For>
        <Show when={overflow() > 0}>
          <span class="bg-muted text-muted-foreground ring-background -ml-1.5 flex size-7 items-center justify-center rounded-full text-[11px] font-medium ring-2">
            +{overflow()}
          </span>
        </Show>
      </div>
    </Show>
  );
}
