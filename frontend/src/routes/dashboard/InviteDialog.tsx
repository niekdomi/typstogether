import { TbOutlineCheck, TbOutlineCopy, TbOutlineLink } from "solid-icons/tb";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import { toast } from "somoto";

import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
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
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { api } from "../../lib/api";
import { formatDate, formatRelative } from "../../lib/format";

import "./InviteDialog.css";

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

function expiryToDate(expiry: Expiry): Date {
  if (expiry === "never") return new Date("9999-12-31T23:59:59Z");
  return new Date(Date.now() + EXPIRY_DAYS[expiry] * DAY_MS);
}

function expiresLabel(expiresAt: Date | string): string {
  const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  if (d.getFullYear() > 9000) return "no expiry";
  return `expires ${formatRelative(d)}`;
}

async function loadInvites(projectId: string) {
  const { data } = await api.projects({ id: projectId }).invites.get();
  return data ?? [];
}

async function loadMembers(projectId: string) {
  const { data } = await api.projects({ id: projectId }).members.get();
  return data ?? [];
}

function memberInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
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
    if (!token) return "";
    return `${location.origin}/invite/${token}`;
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
    const url = linkUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
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

  function reset() {
    setGeneratedToken(null);
    setCopied(false);
  }

  function close() {
    reset();
    props.onClose();
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent>
        <div class="invite-dialog flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Share {props.projectName}</DialogTitle>
          </DialogHeader>
          <p class="invite-sub">Invites are issued only through generated links.</p>

          <section class="invite-section">
            <span class="smallcaps">New link</span>
            <div class="invite-row">
              <ToggleGroup
                variant="outline"
                value={role()}
                onChange={(v) => {
                  if (v) setRole(v as InviteRole);
                }}
                class="flex-1"
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
                  <SelectItem item={p.item}>
                    {
                      { "24h": "24 hours", "7d": "7 days", "30d": "30 days", never: "never" }[
                        p.item.rawValue
                      ]
                    }
                  </SelectItem>
                )}
              >
                <SelectTrigger>
                  <SelectValue<Expiry>>
                    {(state) =>
                      ({
                        "24h": "24 hours",
                        "7d": "7 days",
                        "30d": "30 days",
                        never: "never",
                      })[state.selectedOption()]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
            </div>
            <div class="invite-link-box">
              <TbOutlineLink size={14} />
              <input
                class="invite-link-input"
                readonly
                placeholder="No link yet"
                value={linkUrl()}
              />
              <Button
                variant="outline"
                disabled={!generatedToken()}
                onClick={() => void copyLink()}
              >
                <Show when={copied()} fallback={<TbOutlineCopy size={14} />}>
                  <TbOutlineCheck size={14} />
                </Show>
                {copied() ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button onClick={() => void createInvite()}>Generate link</Button>
          </section>

          <Show when={activeInvites().length > 0}>
            <section class="invite-section">
              <span class="smallcaps">Active links</span>
              <ul class="invite-list">
                <For each={activeInvites()}>
                  {(inv) => (
                    <li class="invite-item">
                      <Badge variant="outline">{inv.role}</Badge>
                      <span class="invite-meta mono">
                        {expiresLabel(inv.expiresAt)} · created {formatDate(inv.createdAt)}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => void revoke(inv.id)}>
                        Revoke
                      </Button>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          </Show>

          <Show when={(members() ?? []).length > 0}>
            <section class="invite-section">
              <span class="smallcaps">People with access</span>
              <ul class="member-list">
                <For each={members() ?? []}>
                  {(m) => (
                    <li class="member-item">
                      <Avatar class="size-6">
                        <AvatarImage src={m.user.image ?? undefined} alt="" />
                        <AvatarFallback class="text-[10px]">
                          {memberInitial(m.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span class="member-name">{m.user.name}</span>
                      <Badge variant="outline">{m.member.role}</Badge>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          </Show>

          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Done
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
