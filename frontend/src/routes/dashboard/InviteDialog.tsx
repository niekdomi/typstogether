import {
  TbOutlineCheck,
  TbOutlineChevronRight,
  TbOutlineCopy,
  TbOutlineLink,
} from "solid-icons/tb";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Separator } from "../../components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { api } from "../../lib/api";
import { formatDate, formatRelative } from "../../lib/format";

type InviteRole = "editor" | "viewer";
type Expiry = "24h" | "7d" | "30d" | "never";

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
  projectName: string;
}

const DAY_MS = 86_400 * 1000;

const EXPIRY_DAYS: Record<Exclude<Expiry, "never">, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
};

const EXPIRY_LABELS: Record<Expiry, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  never: "never",
};

function expiryToDate(expiry: Expiry): Date {
  if (expiry === "never") return new Date("9999-12-31T23:59:59Z");
  return new Date(Date.now() + EXPIRY_DAYS[expiry] * DAY_MS);
}

function expiresLabel(expiresAt: Date | string): string {
  const d = new Date(expiresAt);
  return d.getFullYear() > 9000 ? "no expiry" : `expires ${formatRelative(d)}`;
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
  const [expiry, setExpiry] = createSignal<Expiry>("7d");
  const [generatedToken, setGeneratedToken] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);

  const projectIdMemo = () => props.projectId;

  const [invites, { refetch: refetchInvites }] = createResource(projectIdMemo, loadInvites);
  const [members] = createResource(projectIdMemo, loadMembers);

  const linkUrl = () => {
    const token = generatedToken();
    return token ? `${location.origin}/invite/${token}` : "";
  };

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
      expiresAt: expiryToDate(expiry()),
    });
    if (error) {
      toast.error("Could not create invite link.");
      return;
    }
    setGeneratedToken(data.token);
    void refetchInvites();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(linkUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
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
    setGeneratedToken(null);
    setCopied(false);
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
                    <AvatarFallback class="text-[10px]">
                      {m.user.name.trim().charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span class="flex-1 text-foreground">{m.user.name}</span>
                  <Badge variant="outline">{m.member.role}</Badge>
                </li>
              )}
            </For>
          </ul>
        </Show>

        <Separator />

        <div class="flex flex-col gap-3">
          <div class="text-sm font-medium">Invite via link</div>
          <Show
            when={generatedToken()}
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
                <Select<Expiry>
                  value={expiry()}
                  onChange={(v) => {
                    if (v) setExpiry(v);
                  }}
                  modal={false}
                  options={["24h", "7d", "30d", "never"]}
                  itemComponent={(p) => (
                    <SelectItem item={p.item}>{EXPIRY_LABELS[p.item.rawValue]}</SelectItem>
                  )}
                >
                  <SelectTrigger>
                    <SelectValue<Expiry>>
                      {(state) => EXPIRY_LABELS[state.selectedOption()]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent />
                </Select>
                <Button class="ml-auto" onClick={() => void createInvite()}>
                  Generate
                </Button>
              </div>
            }
          >
            <div class="flex items-center gap-2 rounded-md border border-border bg-muted/40 py-1 pl-3 pr-1">
              <TbOutlineLink size={14} class="shrink-0 text-muted-foreground" />
              <input
                class="min-w-0 flex-1 border-0 bg-transparent font-mono text-xs text-foreground outline-none"
                readonly
                value={linkUrl()}
              />
              <Button variant="outline" size="sm" onClick={() => void copyLink()}>
                <Show when={copied()} fallback={<TbOutlineCopy size={14} />}>
                  <TbOutlineCheck size={14} />
                </Show>
                {copied() ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              class="self-start"
              onClick={() => setGeneratedToken(null)}
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
              class="group -ml-2 self-start gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <TbOutlineChevronRight
                size={14}
                class="transition-transform group-data-[expanded]:rotate-90"
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
                      <span class="flex-1 font-mono text-muted-foreground">
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
