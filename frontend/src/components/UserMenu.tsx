import { TbOutlineChevronDown, TbOutlineLogout, TbOutlinePalette } from "solid-icons/tb";
import { createSignal, Show } from "solid-js";

import { useCurrentUser, useSignOut } from "../lib/CurrentUserContext";
import { userInitial } from "../lib/format";
import ThemePickerDialog from "./ThemePickerDialog";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export default function UserMenu() {
  const current = useCurrentUser();
  const signOut = useSignOut();
  const [themeOpen, setThemeOpen] = createSignal(false);

  return (
    <>
      <DropdownMenu placement="bottom-end" gutter={8}>
        <DropdownMenuTrigger
          as={Button<"button">}
          variant="ghost"
          size="icon"
          class="relative rounded-full p-0 hover:bg-transparent"
          aria-label="Account"
        >
          <Avatar class="size-8">
            <AvatarImage src={current.user.image ?? undefined} alt="" />
            <AvatarFallback>{userInitial(current.user.name)}</AvatarFallback>
          </Avatar>
          <TbOutlineChevronDown
            size={12}
            class="bg-background border-border text-muted-foreground absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border p-px"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent class="min-w-56">
          <div class="flex items-center gap-3 px-2 py-2">
            <Avatar class="size-9">
              <AvatarImage src={current.user.image ?? undefined} alt="" />
              <AvatarFallback>{userInitial(current.user.name)}</AvatarFallback>
            </Avatar>
            <div class="flex min-w-0 flex-col">
              <span class="truncate text-sm font-medium">{current.user.name}</span>
              <Show when={current.user.email}>
                <span class="text-muted-foreground truncate text-xs">{current.user.email}</span>
              </Show>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setThemeOpen(true)}>
            <TbOutlinePalette size={14} />
            Theme
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()}>
            <TbOutlineLogout size={14} />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ThemePickerDialog open={themeOpen()} onOpenChange={setThemeOpen} />
    </>
  );
}
