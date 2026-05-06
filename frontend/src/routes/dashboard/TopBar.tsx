import {
  TbOutlineChevronDown,
  TbOutlineLogout,
  TbOutlineMoon,
  TbOutlineSearch,
  TbOutlineSettings,
  TbOutlineSun,
} from "solid-icons/tb";
import { Show } from "solid-js";

import Logomark from "../../components/Logomark";
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
import { theme, toggleTheme } from "../../lib/theme";

interface TopBarProps {
  query: string;
  onQuery: (value: string) => void;
  userName: string | undefined;
  userEmail: string | undefined;
  userImage: string | null | undefined;
  onSignOut: () => void;
}

function initial(name: string | undefined): string {
  return (name ?? "?").trim().charAt(0).toUpperCase() || "?";
}

export default function TopBar(props: TopBarProps) {
  return (
    <header class="topbar">
      <div class="topbar-left">
        <Logomark size={20} />
      </div>
      <div class="topbar-right">
        <TextField
          value={props.query}
          onChange={props.onQuery}
          class="relative block w-[280px] gap-0"
        >
          <TbOutlineSearch
            size={14}
            class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-1"
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
              <AvatarFallback>{initial(props.userName)}</AvatarFallback>
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
                <AvatarFallback>{initial(props.userName)}</AvatarFallback>
              </Avatar>
              <div class="flex flex-col min-w-0">
                <span class="text-sm font-medium truncate">{props.userName ?? "—"}</span>
                <Show when={props.userEmail}>
                  <span class="text-xs text-muted-foreground truncate">{props.userEmail}</span>
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
