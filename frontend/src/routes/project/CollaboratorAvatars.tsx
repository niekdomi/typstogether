import { For, Show } from "solid-js";

import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { useRemoteAwareness } from "../../lib/collab/use-awareness";
import { userInitial } from "../../lib/format";
import { useProjectContext } from "./ProjectContext";

const MAX_VISIBLE = 3;

export default function CollaboratorAvatars() {
  const ctx = useProjectContext();
  const remoteUsers = useRemoteAwareness(() => ctx.collab.awareness);

  return (
    <Show when={remoteUsers().length > 0}>
      <div class="flex items-center">
        <For each={remoteUsers().slice(0, MAX_VISIBLE)}>
          {(user) => (
            <Tooltip>
              <TooltipTrigger
                as="span"
                class="-ml-1.5 first:ml-0 block rounded-full ring-2 ring-background"
              >
                <Avatar class="size-7">
                  <AvatarImage src={user.image ?? undefined} alt={user.name} />
                  <AvatarFallback
                    class="text-[11px] text-white"
                    style={{ "background-color": user.color }}
                  >
                    {userInitial(user.name)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>{user.name}</TooltipContent>
            </Tooltip>
          )}
        </For>
        <Show when={remoteUsers().length > MAX_VISIBLE}>
          <span class="-ml-1.5 flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground ring-2 ring-background">
            +{remoteUsers().length - MAX_VISIBLE}
          </span>
        </Show>
      </div>
    </Show>
  );
}
