import { TbOutlineSearch } from "solid-icons/tb";

import Logomark from "../../components/Logomark";

interface TopBarProps {
  query: string;
  onQuery: (value: string) => void;
  userName: string | undefined;
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
        <span class="mono path-tag">~/projects</span>
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
        <button type="button" class="user-btn" onClick={props.onSignOut} title="Sign out">
          <span class="avatar">{initial(props.userName)}</span>
          <span>{props.userName ?? "Sign out"}</span>
        </button>
      </div>
    </header>
  );
}
