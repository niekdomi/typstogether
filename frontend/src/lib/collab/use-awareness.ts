import { createEffect, createSignal, onCleanup } from "solid-js";
import type { Awareness } from "y-protocols/awareness";

export interface AwarenessUser {
  clientId: number;
  userId: string;
  name: string;
  color: string;
  image: string | null;
}

interface AwarenessUserState {
  userId?: string;
  name?: string;
  color?: string;
  image?: string | null;
}

/**
 * Reactive signal of remote collaborators currently connected via Yjs awareness.
 * Deduplicates by `userId` so multiple tabs from the same user appear as one entry.
 */
export function useRemoteAwareness(getAwareness: () => Awareness | null) {
  const [users, setUsers] = createSignal<AwarenessUser[]>([]);

  createEffect(() => {
    const awareness = getAwareness();
    if (!awareness) return;

    const sync = () => {
      const seen = new Set<string>();
      const list: AwarenessUser[] = [];
      const localId = awareness.doc.clientID;
      for (const [clientId, state] of awareness.getStates()) {
        if (clientId === localId || !state["user"]) continue;
        const u = state["user"] as AwarenessUserState;
        const userId = u.userId ?? String(clientId);
        if (seen.has(userId)) continue;
        seen.add(userId);
        list.push({
          clientId,
          userId,
          name: u.name ?? "",
          color: u.color ?? "#888",
          image: u.image ?? null,
        });
      }
      setUsers(list);
    };

    sync();
    awareness.on("change", sync);
    onCleanup(() => {
      awareness.off("change", sync);
    });
  });

  return users;
}
