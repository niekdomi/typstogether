import type { EditorView } from "@codemirror/view";
import { useParams } from "@solidjs/router";
import type { Diagnostic, TypstProject } from "@vedivad/codemirror-typst";
import type { RenderedSvgPage } from "@vedivad/typst-web-service";
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js";
import { createStore } from "solid-js/store";
import { toast } from "somoto";
import * as Y from "yjs";

import { useAssetsSync } from "../../lib/assets/use-assets-sync";
import { userColor } from "../../lib/collab/awareness-colors";
import { useCollabDoc } from "../../lib/collab/use-collab-doc";
import { useCurrentUser } from "../../lib/CurrentUserContext";
import { useProject } from "../../lib/projects/use-project";
import { storeThumbnail } from "../../lib/typst/thumbnail-cache";
import { useTypstProject } from "../../lib/typst/use-typst-project";

export interface Ready {
  files: Y.Map<Y.Text>;
  assets: Y.Map<string>;
  typstProject: TypstProject;
}

export interface PreviewState {
  pages: RenderedSvgPage[] | null;
  error: string | null;
}

interface ProjectContextValue {
  projectId: Accessor<string>;
  membership: ReturnType<typeof useProject>;
  collab: ReturnType<typeof useCollabDoc>;
  typst: ReturnType<typeof useTypstProject>;

  ready: Accessor<Ready | null>;
  /**
   * First-page render of the live preview. Owned here (not in PreviewPane) so a
   * single render per compile feeds both the preview and the thumbnail cache.
   */
  preview: PreviewState;
  /**
   * VFS path of the file currently being compiled. Resolves to the per-user
   * preview override when set, falling back to the project's global entry
   * (`collab.entry`).
   */
  entry: Accessor<string>;
  /**
   * Per-user, in-memory override of the compile entry. Memory-only by design:
   * resets on reload, doesn't propagate to other collaborators. Use the
   * project settings panel for changes that should stick and sync.
   */
  previewEntry: Accessor<string | null>;
  setPreviewEntry: (path: string | null) => void;
  activeFile: Accessor<string>;
  activeIsAsset: Accessor<boolean>;
  setActiveFile: (path: string) => void;
  isReadOnly: Accessor<boolean>;

  editorView: Accessor<EditorView | null>;
  setEditorView: (view: EditorView | null) => void;
  jumpToRemoteUser: (clientId: number) => void;

  diagnostics: Accessor<Diagnostic[]>;
  errorCount: Accessor<number>;
}

const ProjectContext = createContext<ProjectContextValue>();

export function ProjectProvider(props: { children: JSX.Element }) {
  const params = useParams<{ id: string }>();
  const projectId = () => params.id;

  const { user } = useCurrentUser();
  const membership = useProject(projectId);
  const collab = useCollabDoc(projectId);
  // Per-user, in-memory preview override. When set, takes precedence over
  // `collab.entry` for compile, but the project-level entry stays put for
  // everyone else (and locks the sidebar's rename/delete on the same file).
  const [previewEntry, setPreviewEntry] = createSignal<string | null>(null);
  const entry = () => previewEntry() ?? collab.entry;
  const typst = useTypstProject(() => collab.files, entry);

  // Broadcast our identity into Yjs awareness for cursors + the avatar bar.
  // Re-runs when the provider (and its awareness) is recreated on project switch.
  createEffect(() => {
    const awareness = collab.awareness;
    if (!awareness) {
      return;
    }

    const { color, colorLight } = userColor(user.id);
    awareness.setLocalStateField("user", {
      userId: user.id,
      name: user.name,
      image: user.image ?? null,
      color,
      colorLight,
    });
  });

  useAssetsSync(
    projectId,
    () => typst.project,
    () => collab.assets
  );

  const isReadOnly = () => membership()?.role === "viewer" || collab.readOnly;

  const [requestedFile, setRequestedFile] = createSignal(entry());
  const [editorView, setEditorView] = createSignal<EditorView | null>(null);
  const [diagnostics, setDiagnostics] = createSignal<Diagnostic[]>([]);

  const errorCount = createMemo(
    () => diagnostics().filter((d) => (d.severity as string) === "error").length
  );

  const ready = createMemo<Ready | null>(() => {
    const files = collab.files;
    const assets = collab.assets;
    const typstProject = typst.project;
    return files && assets && typstProject ? { files, assets, typstProject } : null;
  });

  // Active file falls back to the first available if the requested one was
  // deleted (or never existed). Assets and files share the same path namespace.
  const activeFile = createMemo(() => {
    const r = ready();
    if (!r) return entry();
    const requested = requestedFile();
    if (r.files.has(requested) || r.assets.has(requested)) return requested;
    return [...r.files.keys()][0] ?? entry();
  });

  const activeIsAsset = createMemo(() => ready()?.assets.has(activeFile()) ?? false);

  // Keep `requestedFile` in sync with `activeFile` so the sidebar's selection
  // reflects fallbacks (e.g. when the requested file is deleted).
  createEffect(() => {
    const a = activeFile();
    if (a !== requestedFile()) setRequestedFile(a);
  });

  // Y.Map mutations aren't reactive in Solid, so a remote delete of the open
  // file leaves `activeFile` stale. Bridge the observers into the signal graph
  // by re-pointing `requestedFile` at a valid fallback when its target vanishes.
  createEffect(() => {
    const r = ready();
    if (!r) return;
    const onChange = (event: { transaction: Y.Transaction }) => {
      const current = requestedFile();
      if (r.files.has(current) || r.assets.has(current)) return;
      const entryPath = collab.entry;
      const fallback =
        entryPath && (r.files.has(entryPath) || r.assets.has(entryPath))
          ? entryPath
          : ([...r.files.keys()][0] ?? [...r.assets.keys()][0]);
      if (fallback) setRequestedFile(fallback);
      if (!event.transaction.local) {
        toast(`"${current.replace(/^\//, "")}" was deleted by a collaborator.`);
      }
    };
    r.files.observe(onChange);
    r.assets.observe(onChange);
    onCleanup(() => {
      r.files.unobserve(onChange);
      r.assets.unobserve(onChange);
    });
  });

  // Pipe compile diagnostics out so panels and badges stay in sync.
  createEffect(() => {
    const r = ready();
    if (!r) {
      setDiagnostics([]);
      return;
    }
    const off = r.typstProject.onCompile((result) => {
      setDiagnostics(result.diagnostics);
    });
    onCleanup(off);
  });

  // Render every compile to SVG pages once, here, so PreviewPane and the
  // thumbnail cache both consume a single render.
  const [preview, setPreview] = createStore<PreviewState>({ pages: null, error: null });
  let lastStored: string | undefined;
  createEffect(() => {
    const project = typst.project;
    setPreview({ pages: null, error: null });
    lastStored = undefined;
    if (!project) return;
    const off = project.onCompile((result) => {
      if (result.pages.length === 0) {
        setPreview(
          "error",
          result.diagnostics.find((d) => d.severity === "error")?.message ?? null
        );
        return;
      }
      void (async () => {
        // useTypstProject replaces the project on every change, so an identity
        // check drops a render that resolves after we've switched away.
        try {
          const pages = await project.renderedPages(0, result.pages.length);
          if (typst.project === project) setPreview({ pages, error: null });
        } catch (error) {
          if (typst.project === project) setPreview("error", String(error));
        }
      })();
    });
    onCleanup(off);
  });

  // Refresh the dashboard thumbnail from the live first-page render. Page 1
  // rarely changes, so only write when its rendered SVG actually differs.
  createEffect(() => {
    const svg = preview.pages?.[0]?.svg;
    if (!svg || svg === lastStored) return;
    lastStored = svg;
    void storeThumbnail(projectId(), svg);
  });

  const jumpToRemoteUser = (clientId: number) => {
    const awareness = collab.awareness;
    const ydoc = collab.ydoc;
    const files = collab.files;
    if (!awareness || !ydoc || !files) {
      return;
    }

    const state = awareness.getStates().get(clientId) as
      | { cursor?: { anchor?: unknown; head?: unknown } | null }
      | undefined;

    const head = state?.cursor?.head;
    if (head === null || head === undefined) {
      return;
    }

    const relPos = Y.createRelativePositionFromJSON(head);
    const absPos = Y.createAbsolutePositionFromRelativePosition(relPos, ydoc);
    if (!absPos) {
      return;
    }

    let targetPath: string | undefined;

    for (const [path, text] of files.entries()) {
      if (text === absPos.type) {
        targetPath = path;
        break;
      }
    }

    if (!targetPath) {
      return;
    }

    setRequestedFile(targetPath);

    queueMicrotask(() => {
      const view = editorView();
      if (!view) {
        return;
      }

      view.dispatch({
        selection: { anchor: absPos.index, head: absPos.index },
        scrollIntoView: true,
      });

      view.focus();
    });
  };

  const value: ProjectContextValue = {
    projectId,
    membership,
    collab,
    typst,
    ready,
    preview,
    entry,
    previewEntry,
    setPreviewEntry,
    activeFile,
    activeIsAsset,
    setActiveFile: setRequestedFile,
    isReadOnly,
    editorView,
    setEditorView,
    jumpToRemoteUser,
    diagnostics,
    errorCount,
  };

  return <ProjectContext.Provider value={value}>{props.children}</ProjectContext.Provider>;
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjectContext must be used inside ProjectProvider");
  return ctx;
}
