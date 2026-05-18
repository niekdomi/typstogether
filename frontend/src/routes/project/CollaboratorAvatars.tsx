import { For, Show } from "solid-js";

import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { userColor } from "../../lib/collab/awareness-colors";
import { useRemoteAwareness } from "../../lib/collab/use-awareness";
import { useCurrentUser } from "../../lib/CurrentUserContext";
import { userInitial } from "../../lib/format";
import { useProjectContext } from "./ProjectContext";

const MAX_REMOTE = 4;

function AvatarItem(props: {
  name: string;
  image: string | null | undefined;
  color: string;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        as="span"
        class="ring-background -ml-1.5 block rounded-full ring-2 first:ml-0"
      >
        <Avatar class="size-8">
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
  const remoteUsers = useRemoteAwareness(() => ctx.collab.awareness);
  const { color: selfColor } = userColor(user.id);

  const visibleRemote = () => remoteUsers().slice(0, MAX_REMOTE);
  const overflow = () => remoteUsers().length - MAX_REMOTE;

  return (
    <div class="flex items-center">
      <For each={visibleRemote()}>
        {(u) => <AvatarItem name={u.name} image={u.image} color={u.color} label={u.name} />}
      </For>
      <Show when={overflow() > 0}>
        <span class="bg-muted text-muted-foreground ring-background -ml-1.5 flex size-8 items-center justify-center rounded-full text-[11px] font-medium ring-2">
          +{overflow()}
        </span>
      </Show>
      <Show when={remoteUsers().length > 0}>
        <AvatarItem
          name={user.name}
          image={user.image}
          color={selfColor}
          label={`${user.name} (you)`}
        />
      </Show>
    </div>
  );
}
