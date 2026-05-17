import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import type { Awareness } from "y-protocols/awareness";

export interface RemoteUser {
  clientId: number;
  userId: string;
  name: string;
  color: string;
  image: string | null;
}

/**
 * Reactive list of remote collaborators connected via Yjs awareness. Excludes
 * the local client and dedupes by userId so multiple tabs collapse to one entry.
 */
export function useRemoteAwareness(awareness: Accessor<Awareness | null>): Accessor<RemoteUser[]> {
  const [users, setUsers] = createSignal<RemoteUser[]>([]);

  createEffect(() => {
    const a = awareness();
    if (!a) {
      setUsers([]);
      return;
    }

    const sync = () => {
      const byUserId = new Map<string, RemoteUser>();
      for (const [clientId, state] of a.getStates()) {
        if (clientId === a.clientID) continue;
        const user = state["user"] as Partial<Omit<RemoteUser, "clientId">> | undefined;
        if (!user || typeof user.userId !== "string") continue;
        if (byUserId.has(user.userId)) continue;
        byUserId.set(user.userId, {
          clientId,
          userId: user.userId,
          name: user.name ?? "",
          color: user.color ?? "",
          image: user.image ?? null,
        });
      }
      setUsers([...byUserId.values()]);
    };

    sync();
    a.on("change", sync);
    onCleanup(() => {
      a.off("change", sync);
    });
  });

  return users;
}
