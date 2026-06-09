import { Logger } from "@hocuspocus/extension-logger";
import { Hocuspocus } from "@hocuspocus/server";
import { Elysia } from "elysia";

import { log } from "../../logger";
import { onAuthenticate } from "./auth";
import { blobGcExtension } from "./blob-gc";
import { persistence } from "./persistence";

const collabLog = log.child({ module: "collab" });
const lifecycleLogger = new Logger({
  log: (message: string) => {
    collabLog.info(message.replace(/^\[[^\]]*\]\s*/, ""));
  },
});

const hocuspocus = new Hocuspocus({
  extensions: [lifecycleLogger, persistence, blobGcExtension],
  quiet: false,
  onAuthenticate,
});

const connections = new Map<string, ReturnType<typeof hocuspocus.handleConnection>>();

// Yjs only sends binary frames, anything else is ignored.
function toUint8Array(message: unknown): Uint8Array | null {
  if (message instanceof Uint8Array) return message;
  if (message instanceof ArrayBuffer) return new Uint8Array(message);
  return null;
}

export const collabRoutes = new Elysia({ name: "collab-routes" }).ws("/collab", {
  open(ws) {
    connections.set(ws.id, hocuspocus.handleConnection(ws.raw, ws.data.request));
  },
  message(ws, message) {
    const connection = connections.get(ws.id);
    const bytes = toUint8Array(message);
    if (connection && bytes) connection.handleMessage(bytes);
  },
  close(ws, code, reason) {
    connections.get(ws.id)?.handleClose({ code, reason });
    connections.delete(ws.id);
  },
  error({ error }) {
    log.error({ err: error }, "Collab ws error");
  },
});
