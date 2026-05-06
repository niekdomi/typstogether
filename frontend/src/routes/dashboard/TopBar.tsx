import { TbOutlineMoon, TbOutlineSearch, TbOutlineSun } from "solid-icons/tb";
import { Show } from "solid-js";

import Logomark from "../../components/Logomark";
import { Button } from "../../components/ui/button";
import { TextField, TextFieldInput } from "../../components/ui/text-field";
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
        <Button
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          title={theme() === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          <Show when={theme() === "dark"} fallback={<TbOutlineMoon size={14} />}>
            <TbOutlineSun size={14} />
          </Show>
        </Button>
        <Button
          variant="ghost"
          class="gap-2.5 pl-1 pr-2.5 py-1 h-auto text-sm hover:bg-muted"
          onClick={props.onSignOut}
          title="Sign out"
        >
          <span class="avatar">
            <Show when={props.userImage} fallback={initial(props.userName)}>
              {(src) => <img src={src()} alt="" />}
            </Show>
          </span>
          <span>{props.userName ?? "Sign out"}</span>
        </Button>
      </div>
    </header>
  );
}
