import { Logger } from "@hocuspocus/extension-logger";
import { Hocuspocus } from "@hocuspocus/server";
import crossws from "crossws/adapters/bun";

import { onAuthenticate } from "./auth";
import { persistence } from "./persistence";

const hocuspocus = new Hocuspocus({
  extensions: [new Logger(), persistence],
  quiet: false,
  onAuthenticate,
});

const connections = new Map<string, ReturnType<typeof hocuspocus.handleConnection>>();

export const collabWs = crossws({
  hooks: {
    open(peer) {
      const wsLike = {
        get readyState() {
          return peer.websocket.readyState ?? 3; // 3 = CLOSED
        },
        send(data: unknown) {
          peer.send(data);
        },
        close(code?: number, reason?: string) {
          peer.close(code, reason);
        },
      };
      connections.set(peer.id, hocuspocus.handleConnection(wsLike, peer.request));
    },
    message(peer, message) {
      connections.get(peer.id)?.handleMessage(message.uint8Array());
    },
    close(peer, event) {
      connections
        .get(peer.id)
        ?.handleClose({ code: event.code ?? 1000, reason: event.reason ?? "" });
      connections.delete(peer.id);
    },
    error(peer, error) {
      console.error("WebSocket error for peer:", peer.id, error);
    },
  },
});
