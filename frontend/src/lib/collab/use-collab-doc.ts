import {
  HocuspocusProvider,
  type onAuthenticatedParameters,
  type onAuthenticationFailedParameters,
  type onStatusParameters,
  type onSyncedParameters,
  WebSocketStatus,
} from "@hocuspocus/provider";
import { createEffect, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import * as Y from "yjs";

import { ASSETS_KEY, FILES_KEY, MAIN_PATH } from "../paths";
import { collabWsUrl } from "./ws-url";

interface CollabState {
  ydoc: Y.Doc | null;
  files: Y.Map<Y.Text> | null;
  // path → sha256 of a blob stored via the backend's project_blob table.
  assets: Y.Map<string> | null;
  status: WebSocketStatus;
  synced: boolean;
  readOnly: boolean;
  error: string | null;
}

export function useCollabDoc(projectId: () => string) {
  const [state, setState] = createStore<CollabState>({
    ydoc: null,
    files: null,
    assets: null,
    status: WebSocketStatus.Connecting,
    synced: false,
    readOnly: false,
    error: null,
  });

  createEffect(() => {
    const id = projectId();
    if (!id) return;

    setState({
      status: WebSocketStatus.Connecting,
      synced: false,
      readOnly: false,
      error: null,
    });

    const doc = new Y.Doc();
    const filesMap = doc.getMap<Y.Text>(FILES_KEY);
    const assetsMap = doc.getMap<string>(ASSETS_KEY);
    const provider = new HocuspocusProvider({
      url: collabWsUrl(),
      name: id,
      document: doc,
    });

    provider.on("status", (data: onStatusParameters) => {
      setState("status", data.status);
    });
    provider.on("synced", (data: onSyncedParameters) => {
      setState("synced", data.state);
      if (!data.state) return;
      // After initial sync, ensure at least one file exists in the project.
      if (filesMap.size === 0) {
        doc.transact(() => {
          filesMap.set(MAIN_PATH, new Y.Text());
        });
      }
      // Only expose the maps once they're guaranteed to be populated, so the
      // typst project hook never sees a transient empty state.
      setState({ files: filesMap, assets: assetsMap });
    });
    provider.on("authenticated", (data: onAuthenticatedParameters) => {
      setState("readOnly", data.scope === "readonly");
    });
    provider.on("authenticationFailed", (data: onAuthenticationFailedParameters) => {
      setState("error", data.reason);
    });

    setState("ydoc", doc);

    onCleanup(() => {
      provider.destroy();
      doc.destroy();
      setState({ ydoc: null, files: null, assets: null });
    });
  });

  return state;
}
