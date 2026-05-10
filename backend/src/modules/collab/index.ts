import { Logger } from "@hocuspocus/extension-logger";
import { Hocuspocus } from "@hocuspocus/server";
import { Elysia } from "elysia";

import { onAuthenticate } from "./auth";
import { persistence } from "./persistence";

const hocuspocus = new Hocuspocus({
  extensions: [new Logger(), persistence],
  quiet: false,
  onAuthenticate,
});

const connections = new Map<string, ReturnType<typeof hocuspocus.handleConnection>>();

export const collabRoutes = new Elysia({ name: "collab-routes" }).ws("/collab", {
  open(ws) {
    connections.set(ws.id, hocuspocus.handleConnection(ws.raw, ws.data.request));
  },
  message(ws, message) {
    if (typeof message === "string") return;
    const bytes =
      message instanceof Uint8Array
        ? message
        : message instanceof ArrayBuffer
          ? new Uint8Array(message)
          : null;
    if (!bytes) return;
    connections.get(ws.id)?.handleMessage(bytes);
  },
  close(ws, code, reason) {
    connections.get(ws.id)?.handleClose({ code, reason });
    connections.delete(ws.id);
  },
});
