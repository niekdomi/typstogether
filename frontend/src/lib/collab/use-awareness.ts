import { createEffect, createSignal, onCleanup } from "solid-js";
import type { Awareness } from "y-protocols/awareness";

interface AwarenessUser {
  clientId: number;
  userId: string;
  name: string;
  color: string;
  avatar: string;
}

/**
 * Reactive signal of remote collaborators currently connected via Yjs
 * awareness. Deduplicates by `userId` so multiple tabs from the same user
 * appear as one entry.
 */
export function useRemoteAwareness(getAwareness: () => Awareness | null) {
  const [users, setUsers] = createSignal<AwarenessUser[]>([]);

  createEffect(() => {
    const awareness = getAwareness();
    if (!awareness) {
      return;
    }

    const sync = () => {
      const map = new Map<string, AwarenessUser>();

      for (const [clientId, state] of awareness.getStates()) {
        if (clientId === awareness.doc.clientID || state["user"] === null) {
          continue;
        }

        const user = state["user"] as Omit<AwarenessUser, "clientId">;

        if (!map.has(user.userId)) {
          map.set(user.userId, { clientId, ...user });
        }
      }

      setUsers([...map.values()]);
    };

    sync();
    awareness.on("change", sync);

    onCleanup(() => {
      awareness.off("change", sync);
    });
  });

  return users;
}
