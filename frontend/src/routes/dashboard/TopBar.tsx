import { TbOutlineSearch } from "solid-icons/tb";

import Logo from "../../components/Logo";
import { TextField, TextFieldInput } from "../../components/ui/text-field";
import UserMenu from "../../components/UserMenu";

interface TopBarProps {
  query: string;
  onQuery: (value: string) => void;
}

export default function TopBar(props: TopBarProps) {
  return (
    <header class="border-border bg-background sticky top-0 z-10 flex items-center justify-between border-b px-8 py-4.5">
      <Logo size={20} />
      <div class="flex items-center gap-4.5">
        <TextField value={props.query} onChange={props.onQuery} class="relative block w-70 gap-0">
          <TbOutlineSearch
            size={14}
            class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-1 -translate-y-1/2"
          />
          <TextFieldInput type="text" placeholder="Find a project…" class="w-full pl-9" />
        </TextField>
        <UserMenu />
      </div>
    </header>
  );
}
