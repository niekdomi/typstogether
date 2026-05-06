import { TbOutlineMoon, TbOutlineSearch, TbOutlineSun } from "solid-icons/tb";
import { Show } from "solid-js";

import Logomark from "../../components/Logomark";
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
        <button
          type="button"
          class="icon-btn"
          onClick={toggleTheme}
          title={theme() === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          <Show when={theme() === "dark"} fallback={<TbOutlineMoon size={14} />}>
            <TbOutlineSun size={14} />
          </Show>
        </button>
        <button type="button" class="user-btn" onClick={props.onSignOut} title="Sign out">
          <span class="avatar">
            <Show when={props.userImage} fallback={initial(props.userName)}>
              {(src) => <img src={src()} alt="" />}
            </Show>
          </span>
          <span>{props.userName ?? "Sign out"}</span>
        </button>
      </div>
    </header>
  );
}
