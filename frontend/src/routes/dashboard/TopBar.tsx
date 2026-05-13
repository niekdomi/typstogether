import { TbOutlineSearch } from "solid-icons/tb";

import Logo from "../../components/Logo";
import ThemeToggle from "../../components/ThemeToggle";
import { TextField, TextFieldInput } from "../../components/ui/text-field";
import UserMenu from "../../components/UserMenu";

interface TopBarProps {
  query: string;
  onQuery: (value: string) => void;
}

export default function TopBar(props: TopBarProps) {
  return (
    <header class="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-8 py-4.5">
      <Logo size={20} />
      <div class="flex items-center gap-4.5">
        <TextField value={props.query} onChange={props.onQuery} class="relative block w-70 gap-0">
          <TbOutlineSearch
            size={14}
            class="pointer-events-none absolute left-3 top-1/2 z-1 -translate-y-1/2 text-muted-foreground"
          />
          <TextFieldInput type="text" placeholder="Find a project…" class="pl-9 w-full" />
        </TextField>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
