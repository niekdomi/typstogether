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

import { FILES_KEY, MAIN_PATH } from "../paths";
import { collabWsUrl } from "./ws-url";

export function useCollabDoc(projectId: () => string) {
  const [ydoc, setYdoc] = createSignal<Y.Doc | null>(null);
  const [files, setFiles] = createSignal<Y.Map<Y.Text> | null>(null);
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
    const map = doc.getMap<Y.Text>(FILES_KEY);
    const provider = new HocuspocusProvider({
      url: collabWsUrl(),
      name: id,
      document: doc,
    });

    provider.on("status", (data: onStatusParameters) => setStatus(data.status));
    provider.on("synced", (data: onSyncedParameters) => {
      setSynced(data.state);
      if (!data.state) return;
      // After initial sync, ensure at least one file exists in the project.
      if (map.size === 0) {
        doc.transact(() => {
          map.set(MAIN_PATH, new Y.Text());
        });
      }
      // Only expose `files` once the map is guaranteed to be populated, so
      // the typst project hook never sees a transient empty map.
      setFiles(map);
    });
    provider.on("authenticated", (data: onAuthenticatedParameters) => {
      setReadOnly(data.scope === "readonly");
    });
    provider.on("authenticationFailed", (data: onAuthenticationFailedParameters) =>
      setError(data.reason)
    );

    setYdoc(doc);

    onCleanup(() => {
      provider.destroy();
      doc.destroy();
      setYdoc(null);
      setFiles(null);
    });
  });

  return { ydoc, files, status, synced, readOnly, error };
}
