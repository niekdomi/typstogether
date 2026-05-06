import { TbOutlineMoon, TbOutlineSearch, TbOutlineSun } from "solid-icons/tb";
import { Show } from "solid-js";

import Logomark from "../../components/Logomark";
import { Button } from "../../components/ui/button";
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
        <label class="search">
          <TbOutlineSearch size={13} />
          <input
            type="text"
            placeholder="Find a project…"
            value={props.query}
            onInput={(e) => {
              props.onQuery(e.currentTarget.value);
            }}
          />
          <span class="mono kbd">⌘K</span>
        </label>
        <Button
          variant="outline"
          size="icon-sm"
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
