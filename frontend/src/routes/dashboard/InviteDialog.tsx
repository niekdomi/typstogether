import { TbOutlineCheck, TbOutlineCopy, TbOutlineLink } from "solid-icons/tb";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { api } from "../../lib/api";
import { formatDate, formatRelative } from "../../lib/format";
import { toast } from "../../lib/toast";

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
              <div class="role-toggle">
                <button
                  type="button"
                  class={`role-cell${role() === "editor" ? " active" : ""}`}
                  onClick={() => setRole("editor")}
                >
                  Editor
                </button>
                <button
                  type="button"
                  class={`role-cell${role() === "viewer" ? " active" : ""}`}
                  onClick={() => setRole("viewer")}
                >
                  Viewer
                </button>
              </div>
              <select
                class="invite-select"
                value={expiry()}
                onChange={(e) => setExpiry(e.currentTarget.value as Expiry)}
              >
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="never">never</option>
              </select>
            </div>
            <div class="invite-link-box">
              <TbOutlineLink size={14} />
              <input
                class="invite-link-input"
                readonly
                placeholder="No link yet"
                value={linkUrl()}
              />
              <button
                type="button"
                class="btn"
                disabled={!generatedToken()}
                onClick={() => void copyLink()}
              >
                <Show when={copied()} fallback={<TbOutlineCopy size={14} />}>
                  <TbOutlineCheck size={14} />
                </Show>
                {copied() ? "Copied" : "Copy"}
              </button>
            </div>
            <button type="button" class="btn btn-primary" onClick={() => void createInvite()}>
              Generate link
            </button>
          </section>

          <Show when={activeInvites().length > 0}>
            <section class="invite-section">
              <span class="smallcaps">Active links</span>
              <ul class="invite-list">
                <For each={activeInvites()}>
                  {(inv) => (
                    <li class="invite-item">
                      <span class="pill">{inv.role}</span>
                      <span class="invite-meta mono">
                        {expiresLabel(inv.expiresAt)} · created {formatDate(inv.createdAt)}
                      </span>
                      <button
                        type="button"
                        class="btn btn-ghost"
                        onClick={() => void revoke(inv.id)}
                      >
                        Revoke
                      </button>
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
                      <span class="avatar-small">
                        <Show when={m.user.image} fallback={memberInitial(m.user.name)}>
                          {(src) => <img src={src()} alt="" />}
                        </Show>
                      </span>
                      <span class="member-name">{m.user.name}</span>
                      <span class="pill">{m.member.role}</span>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          </Show>

          <DialogFooter>
            <button type="button" class="btn" onClick={close}>
              Done
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
