import { Logger } from "@hocuspocus/extension-logger";
import { Hocuspocus } from "@hocuspocus/server";
import crossws from "crossws/adapters/bun";

import { collabPort } from "../../env";
import { onAuthenticate } from "./auth";
import { persistence } from "./persistence";

const hocuspocus = new Hocuspocus({
  extensions: [new Logger(), persistence],
  onAuthenticate,
});

const connection = new Map<string, ReturnType<typeof hocuspocus.handleConnection>>();

const ws = crossws({
  hooks: {
    open(peer) {
      const wsLike = {
        get readyState() {
          return peer.websocket.readyState ?? 3;
        },
        send(data: unknown) {
          peer.send(data);
        },
        close(code?: number, reason?: string) {
          peer.close(code, reason);
        },
      };
      connection.set(peer.id, hocuspocus.handleConnection(wsLike, peer.request));
    },
    message(peer, message) {
      connection.get(peer.id)?.handleMessage(message.uint8Array());
    },
    close(peer, event) {
      connection
        .get(peer.id)
        ?.handleClose({ code: event.code ?? 1000, reason: event.reason ?? "" });
      connection.delete(peer.id);
    },
    error(peer, error) {
      console.error("Websocket error for peer", peer.id, error);
    },
  },
});

export function startCollabServer() {
  Bun.serve({
    port: collabPort,
    websocket: ws.websocket,
    fetch(request, server) {
      if (request.headers.get("upgrade") === "websocket") {
        return ws.handleUpgrade(request, server);
      }
      return new Response("OK");
    },
  });

  console.log("Collab server running on port", collabPort);
}
