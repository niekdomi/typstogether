import {
  TbOutlineChevronDown,
  TbOutlineLogout,
  TbOutlineMoon,
  TbOutlineSearch,
  TbOutlineSettings,
  TbOutlineSun,
} from "solid-icons/tb";
import { Show } from "solid-js";

import Logo from "../../components/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { TextField, TextFieldInput } from "../../components/ui/text-field";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { userInitial } from "../../lib/format";
import { theme, toggleTheme } from "../../lib/theme";

interface TopBarProps {
  query: string;
  onQuery: (value: string) => void;
  userName: string | undefined;
  userEmail: string | undefined;
  userImage: string | null | undefined;
  onSignOut: () => void;
}

export default function TopBar(props: TopBarProps) {
  return (
    <header class="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-8 py-4.5">
      <Logo size={20} />
      <div class="flex items-center gap-4.5">
        <TextField
          value={props.query}
          onChange={props.onQuery}
          class="relative block w-70 gap-0"
        >
          <TbOutlineSearch
            size={14}
            class="pointer-events-none absolute left-3 top-1/2 z-1 -translate-y-1/2 text-muted-foreground"
          />
          <TextFieldInput type="text" placeholder="Find a project…" class="pl-9 w-full" />
        </TextField>
        <Tooltip openDelay={150}>
          <TooltipTrigger as={Button<"button">} variant="outline" size="icon" onClick={toggleTheme}>
            <Show when={theme() === "dark"} fallback={<TbOutlineMoon size={14} />}>
              <TbOutlineSun size={14} />
            </Show>
          </TooltipTrigger>
          <TooltipContent>
            {theme() === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          </TooltipContent>
        </Tooltip>
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
      </div>
    </header>
  );
}
