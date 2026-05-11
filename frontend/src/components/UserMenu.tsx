import { TbOutlineChevronDown, TbOutlineLogout, TbOutlineSettings } from "solid-icons/tb";
import { Show } from "solid-js";

import { userInitial } from "../lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface UserMenuProps {
  userName: string | undefined;
  userEmail: string | undefined;
  userImage: string | null | undefined;
  onSignOut: () => void;
}

export default function UserMenu(props: UserMenuProps) {
  return (
    <DropdownMenu placement="bottom-end" gutter={8}>
      <DropdownMenuTrigger
        as={Button<"button">}
        variant="ghost"
        size="icon"
        class="relative rounded-full p-0 hover:bg-transparent"
        aria-label="Account"
      >
        <Avatar class="size-8">
          <AvatarImage src={props.userImage ?? undefined} alt="" />
          <AvatarFallback>{userInitial(props.userName)}</AvatarFallback>
        </Avatar>
        <TbOutlineChevronDown
          size={12}
          class="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-background border border-border p-px text-muted-foreground"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent class="min-w-56">
        <div class="flex items-center gap-3 px-2 py-2">
          <Avatar class="size-9">
            <AvatarImage src={props.userImage ?? undefined} alt="" />
            <AvatarFallback>{userInitial(props.userName)}</AvatarFallback>
          </Avatar>
          <div class="flex min-w-0 flex-col">
            <span class="truncate text-sm font-medium">{props.userName ?? "—"}</span>
            <Show when={props.userEmail}>
              <span class="truncate text-xs text-muted-foreground">{props.userEmail}</span>
            </Show>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <TbOutlineSettings size={14} />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={props.onSignOut}>
          <TbOutlineLogout size={14} />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
