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
 * the local client; each remote tab is a distinct entry so multiple tabs from
 * the same user surface as separate cursors.
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
      const next: RemoteUser[] = [];

      for (const [clientId, state] of awareness.getStates()) {
        if (clientId === awareness.clientID) continue;

        const user = state["user"] as Omit<RemoteUser, "clientId"> | undefined;
        if (!user || typeof user.userId !== "string") {
          continue;
        }

        next.push({ clientId, ...user });
      }
      setUsers(next);
    };

    sync();
    awareness.on("change", sync);
    onCleanup(() => {
      awareness.off("change", sync);
    });
  });

  return users;
}
