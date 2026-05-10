import {
  HocuspocusProvider,
  type onAuthenticatedParameters,
  type onAuthenticationFailedParameters,
  type onStatusParameters,
  type onSyncedParameters,
  WebSocketStatus,
} from "@hocuspocus/provider";
import { createEffect, createSignal, onCleanup } from "solid-js";
import * as Y from "yjs";

import { MAIN_FILE } from "../paths";
import { collabWsUrl } from "./ws-url";

export function useCollabDoc(projectId: () => string) {
  const [ydoc, setYdoc] = createSignal<Y.Doc | null>(null);
  const [ytext, setYtext] = createSignal<Y.Text | null>(null);
  const [status, setStatus] = createSignal<WebSocketStatus>(WebSocketStatus.Connecting);
  const [synced, setSynced] = createSignal(false);
  const [readOnly, setReadOnly] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    const id = projectId();
    if (!id) return;

    setStatus(WebSocketStatus.Connecting);
    setSynced(false);
    setReadOnly(false);
    setError(null);

    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: collabWsUrl(),
      name: id,
      document: doc,
    });

    provider.on("status", (data: onStatusParameters) => setStatus(data.status));
    provider.on("synced", (data: onSyncedParameters) => setSynced(data.state));
    provider.on("authenticated", (data: onAuthenticatedParameters) => {
      setReadOnly(data.scope === "readonly");
    });
    provider.on("authenticationFailed", (data: onAuthenticationFailedParameters) =>
      setError(data.reason)
    );

    setYdoc(doc);
    setYtext(doc.getText(MAIN_FILE));

    onCleanup(() => {
      provider.destroy();
      doc.destroy();
      setYdoc(null);
      setYtext(null);
    });
  });

  return { ydoc, ytext, status, synced, readOnly, error };
}
