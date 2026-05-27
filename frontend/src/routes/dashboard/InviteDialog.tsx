import {
  TbOutlineCheck,
  TbOutlineChevronRight,
  TbOutlineCopy,
  TbOutlineLink,
} from "solid-icons/tb";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { toast } from "somoto";

import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Separator } from "../../components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { api } from "../../lib/api";
import { formatDate, formatRelative, userInitial } from "../../lib/format";

type InviteRole = "editor" | "viewer";

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
  projectName: string;
}

const INVITE_TTL_MS = 7 * 86_400 * 1000;

function expiresLabel(expiresAt: Date | string): string {
  return `expires ${formatRelative(new Date(expiresAt))}`;
}

async function loadInvites(projectId: string) {
  const { data } = await api.projects({ id: projectId }).invites.get();
  return data ?? [];
}

async function loadMembers(projectId: string) {
  const { data } = await api.projects({ id: projectId }).members.get();
  return data ?? [];
}

export default function InviteDialog(props: InviteDialogProps) {
  const [role, setRole] = createSignal<InviteRole>("editor");
  const [link, setLink] = createStore<{ token: string | null; copied: boolean }>({
    token: null,
    copied: false,
  });
  let urlInput: HTMLInputElement | undefined;

  const [invites, { refetch: refetchInvites }] = createResource(() => props.projectId, loadInvites);
  const [members] = createResource(() => props.projectId, loadMembers);

  const linkUrl = () => (link.token ? `${location.origin}/invite/${link.token}` : "");

  const activeInvites = createMemo(() => {
    const now = Date.now();
    return (invites() ?? []).filter(
      (i) => i.revokedAt === null && new Date(i.expiresAt).getTime() > now
    );
  });

  async function createInvite() {
    if (!props.projectId) return;
    const { data, error } = await api.projects({ id: props.projectId }).invites.post({
      role: role(),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    if (error) {
      toast.error("Could not create invite link.");
      return;
    }
    setLink({ token: data.token, copied: false });
    void refetchInvites();
  }

  function markCopied() {
    setLink("copied", true);
    setTimeout(() => {
      setLink("copied", false);
    }, 1400);
  }

  async function copyLink() {
    const url = linkUrl();
    // navigator.clipboard is only available in secure contexts (HTTPS / localhost).
    // Fall back to selecting the visible input + execCommand for plain-HTTP deploys.
    if (globalThis.isSecureContext) {
      try {
        await navigator.clipboard.writeText(url);
        markCopied();
        return;
      } catch {
        // fall through to execCommand fallback
      }
    }
    // The input lives inside the dialog's focus scope, so selecting it (rather
    // than a detached textarea) survives the dialog's focus trap.
    try {
      if (!urlInput) throw new Error("urlInput is not mounted");
      urlInput.focus();
      urlInput.select();
      urlInput.setSelectionRange(0, url.length);
      // oxlint-disable-next-line typescript/no-deprecated
      if (!document.execCommand("copy")) throw new Error("execCommand copy failed");
      markCopied();
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  async function revoke(inviteId: string) {
    if (!props.projectId) return;
    const { error } = await api.projects({ id: props.projectId }).invites({ inviteId }).delete();
    if (error) {
      toast.error("Could not revoke link.");
      return;
    }
    void refetchInvites();
  }

  function close() {
    setLink({ token: null, copied: false });
    props.onClose();
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent class="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Share {props.projectName}</DialogTitle>
        </DialogHeader>

        <Show when={(members() ?? []).length > 0}>
          <ul class="flex flex-col gap-2">
            <For each={members() ?? []}>
              {(m) => (
                <li class="flex items-center gap-3 text-sm">
                  <Avatar class="size-7">
                    <AvatarImage src={m.user.image ?? undefined} alt="" />
                    <AvatarFallback class="text-[10px]">{userInitial(m.user.name)}</AvatarFallback>
                  </Avatar>
                  <span class="text-foreground flex-1">{m.user.name}</span>
                  <Badge variant="outline">{m.member.role}</Badge>
                </li>
              )}
            </For>
          </ul>
        </Show>

        <Separator />

        <div class="flex flex-col gap-3">
          <div class="flex items-baseline justify-between gap-2">
            <div class="text-sm font-medium">Invite via link</div>
            <div class="text-muted-foreground text-xs">Expires in 7 days</div>
          </div>
          <Show
            when={link.token}
            fallback={
              <div class="flex items-center gap-2">
                <ToggleGroup
                  variant="outline"
                  value={role()}
                  onChange={(v) => {
                    if (v) setRole(v as InviteRole);
                  }}
                >
                  <ToggleGroupItem value="editor">Editor</ToggleGroupItem>
                  <ToggleGroupItem value="viewer">Viewer</ToggleGroupItem>
                </ToggleGroup>
                <Button class="ml-auto" onClick={() => void createInvite()}>
                  Generate
                </Button>
              </div>
            }
          >
            <div class="border-border bg-muted/40 flex items-center gap-2 rounded-md border py-1 pr-1 pl-3">
              <TbOutlineLink size={14} class="text-muted-foreground shrink-0" />
              <input
                ref={(el) => {
                  urlInput = el;
                }}
                class="text-foreground min-w-0 flex-1 border-0 bg-transparent font-mono text-xs outline-none"
                readonly
                value={linkUrl()}
              />
              <Button variant="outline" size="sm" onClick={() => void copyLink()}>
                <Show when={link.copied} fallback={<TbOutlineCopy size={14} />}>
                  <TbOutlineCheck size={14} />
                </Show>
                {link.copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              class="self-start"
              onClick={() => {
                setLink({ token: null, copied: false });
              }}
            >
              Generate another link
            </Button>
          </Show>
        </div>

        <Show when={activeInvites().length > 0}>
          <Collapsible class="flex flex-col gap-2">
            <CollapsibleTrigger
              as={Button<"button">}
              variant="ghost"
              size="sm"
              class="group text-muted-foreground hover:text-foreground -ml-2 gap-1.5 self-start"
            >
              <TbOutlineChevronRight
                size={14}
                class="transition-transform group-data-expanded:rotate-90"
              />
              {activeInvites().length} active invite
              {activeInvites().length === 1 ? "" : "s"}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul class="flex flex-col gap-1.5 pl-1">
                <For each={activeInvites()}>
                  {(inv) => (
                    <li class="flex items-center gap-3 text-xs">
                      <Badge variant="outline">{inv.role}</Badge>
                      <span class="text-muted-foreground flex-1 font-mono">
                        {expiresLabel(inv.expiresAt)} · created {formatDate(inv.createdAt)}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => void revoke(inv.id)}>
                        Revoke
                      </Button>
                    </li>
                  )}
                </For>
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </Show>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
