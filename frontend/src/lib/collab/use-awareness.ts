import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import type { Awareness } from "y-protocols/awareness";

interface RemoteUser {
  clientId: number;
  userId: string;
  name: string;
  color: string;
  image: string;
}

/**
 * Reactive list of remote collaborators connected via Yjs awareness. Excludes
 * the local client and dedupes by userId so multiple tabs collapse to one entry.
 */
export function useRemoteAwareness(
  getAwareness: Accessor<Awareness | null>
): Accessor<RemoteUser[]> {
  const [users, setUsers] = createSignal<RemoteUser[]>([]);

  createEffect(() => {
    const awareness = getAwareness();
    if (!awareness) {
      setUsers([]);
      return;
    }

    const sync = () => {
      const byUserId = new Map<string, RemoteUser>();

      for (const [clientId, state] of awareness.getStates()) {
        if (clientId === awareness.clientID) continue;

        const user = state["user"] as Omit<RemoteUser, "clientId"> | undefined;
        if (!user || typeof user.userId !== "string") continue;

        if (!byUserId.has(user.userId)) {
          byUserId.set(user.userId, { clientId, ...user });
        }
      }
      setUsers([...byUserId.values()]);
    };

    sync();
    awareness.on("change", sync);
    onCleanup(() => {
      awareness.off("change", sync);
    });
  });

  return users;
}
