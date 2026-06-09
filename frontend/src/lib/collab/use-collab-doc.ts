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
import type { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";

import { ASSETS_KEY, ENTRY_KEY, FILES_KEY, FONTS_KEY, MAIN_PATH, META_KEY } from "../paths";
import { collabWsUrl } from "./ws-url";

interface CollabState {
  ydoc: Y.Doc | null;
  files: Y.Map<Y.Text> | null;
  // path -> blob_id of a row stored in the backend's project_blob table.
  assets: Y.Map<string> | null;
  // filename -> blob_id; custom fonts the compiler registers via `addFont`.
  fonts: Y.Map<string> | null;
  // Project-level metadata that needs to sync across collaborators (currently
  // just the compile entry). Stored in the same Y.Doc as files/assets so a
  // change made by one client lands instantly for everyone else.
  meta: Y.Map<string> | null;
  /** Mirror of `meta.get("entry")` so consumers don't need a Y.Map observer. */
  entry: string;
  awareness: Awareness | null;
  status: WebSocketStatus;
  synced: boolean;
  readOnly: boolean;
  error: string | null;
  /**
   * Update the project's compile entry. No-op when the Y.Doc isn't ready.
   * Method shorthand so `this` binds to the store proxy at call time, reading
   * the live meta map without a parallel reference.
   */
  setEntry: (path: string) => void;
}

export function useCollabDoc(projectId: () => string) {
  const [state, setState] = createStore<CollabState>({
    ydoc: null,
    files: null,
    assets: null,
    fonts: null,
    meta: null,
    entry: MAIN_PATH,
    awareness: null,
    status: WebSocketStatus.Connecting,
    synced: false,
    readOnly: false,
    error: null,
    setEntry(path: string) {
      this.meta?.set(ENTRY_KEY, path);
    },
  });

  createEffect(() => {
    const id = projectId();
    if (!id) return;

    setState({
      status: WebSocketStatus.Connecting,
      synced: false,
      readOnly: false,
      error: null,
      entry: MAIN_PATH,
    });

    const doc = new Y.Doc();
    const filesMap = doc.getMap<Y.Text>(FILES_KEY);
    const assetsMap = doc.getMap<string>(ASSETS_KEY);
    const fontsMap = doc.getMap<string>(FONTS_KEY);
    const metaMap = doc.getMap<string>(META_KEY);
    const provider = new HocuspocusProvider({
      url: collabWsUrl(),
      name: id,
      document: doc,
    });

    // Mirror meta.entry into Solid state so consumers react
    // without observing the Y.Map themselves.
    const refreshEntry = () => {
      setState("entry", metaMap.get(ENTRY_KEY) ?? MAIN_PATH);
    };
    metaMap.observe(refreshEntry);

    provider.on("status", (data: onStatusParameters) => {
      setState("status", data.status);
    });
    provider.on("synced", (data: onSyncedParameters) => {
      setState("synced", data.state);
      if (!data.state) return;
      // After initial sync, ensure at least one file exists. Seed at the
      // already-synced entry (templates set this server-side; blank projects
      // fall back to the default).
      if (filesMap.size === 0) {
        doc.transact(() => {
          filesMap.set(metaMap.get(ENTRY_KEY) ?? MAIN_PATH, new Y.Text());
        });
      }
      refreshEntry();
      // Only expose the maps once they're guaranteed to be populated, so the
      // typst project hook never sees a transient empty state.
      setState({ files: filesMap, assets: assetsMap, fonts: fontsMap, meta: metaMap });
    });
    provider.on("authenticated", (data: onAuthenticatedParameters) => {
      setState("readOnly", data.scope === "readonly");
    });
    provider.on("authenticationFailed", (data: onAuthenticationFailedParameters) => {
      setState("error", data.reason);
    });

    setState({ ydoc: doc, awareness: provider.awareness });

    onCleanup(() => {
      metaMap.unobserve(refreshEntry);
      provider.destroy();
      doc.destroy();
      setState({ ydoc: null, files: null, assets: null, fonts: null, meta: null, awareness: null });
    });
  });

  return state;
}
