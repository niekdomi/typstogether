import { TbOutlineMoon, TbOutlineSearch, TbOutlineSun } from "solid-icons/tb";
import { Show } from "solid-js";

import Logomark from "../../components/Logomark";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { TextField, TextFieldInput } from "../../components/ui/text-field";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { theme, toggleTheme } from "../../lib/theme";

interface TopBarProps {
  query: string;
  onQuery: (value: string) => void;
  userName: string | undefined;
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
        <Tooltip openDelay={150}>
          <TooltipTrigger
            as={Button<"button">}
            variant="ghost"
            class="gap-2.5 pl-1 pr-2.5 py-1 h-auto text-sm hover:bg-muted"
            onClick={props.onSignOut}
          >
            <Avatar class="size-7">
              <AvatarImage src={props.userImage ?? undefined} alt="" />
              <AvatarFallback>{initial(props.userName)}</AvatarFallback>
            </Avatar>
            <span>{props.userName ?? "Sign out"}</span>
          </TooltipTrigger>
          <TooltipContent>Sign out</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
