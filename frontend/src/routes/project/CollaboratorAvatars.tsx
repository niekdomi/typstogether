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
  onClick?: () => void;
}

function AvatarPill(props: AvatarPillProps) {
  const avatar = () => (
    <Avatar class="size-7">
      <AvatarImage src={props.image ?? undefined} alt={props.name} />
      <AvatarFallback class="text-[11px] text-white" style={{ "background-color": props.color }}>
        {userInitial(props.name)}
      </AvatarFallback>
    </Avatar>
  );
  return (
    <Tooltip>
      <Show
        when={props.onClick}
        fallback={
          <TooltipTrigger
            as="span"
            class="ring-background -ml-1.5 block rounded-full ring-2 first:ml-0"
          >
            {avatar()}
          </TooltipTrigger>
        }
      >
        {(onClick) => (
          <TooltipTrigger
            as="button"
            type="button"
            onClick={onClick()}
            class="ring-background hover:ring-foreground/40 -ml-1.5 block cursor-pointer rounded-full ring-2 transition-shadow first:ml-0"
          >
            {avatar()}
          </TooltipTrigger>
        )}
      </Show>
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

  return (
    <Show when={remote().length > 0}>
      <div class="flex items-center">
        <For each={visible()}>
          {(u) => (
            <AvatarPill
              name={u.name}
              image={u.image}
              color={u.color}
              label={u.name}
              onClick={() => {
                ctx.jumpToRemoteUser(u.clientId);
              }}
            />
          )}
        </For>
        <Show when={overflow() > 0}>
          <span class="bg-muted text-muted-foreground ring-background -ml-1.5 flex size-7 items-center justify-center rounded-full text-[11px] font-medium ring-2">
            +{overflow()}
          </span>
        </Show>
        <AvatarPill
          name={user.name}
          image={user.image ?? null}
          color={userColor(user.id).color}
          label={`${user.name} (you)`}
        />
      </div>
    </Show>
  );
}
