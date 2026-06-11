import { EditorView } from "@codemirror/view";
import { useParams } from "@solidjs/router";
import type { Diagnostic, TypstProject } from "@vedivad/codemirror-typst";
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
import { createStore, produce } from "solid-js/store";
import { toast } from "somoto";
import * as Y from "yjs";

import { useAssetsSync } from "../../lib/assets/use-assets-sync";
import { userColor } from "../../lib/collab/awareness-colors";
import { useCollabDoc } from "../../lib/collab/use-collab-doc";
import { useCurrentUser } from "../../lib/CurrentUserContext";
import { useFontsSync } from "../../lib/fonts/use-fonts-sync";
import { useProject } from "../../lib/projects/use-project";
import { storeThumbnail } from "../../lib/typst/thumbnail-cache";
import { useTypstProject } from "../../lib/typst/use-typst-project";

export interface Ready {
  files: Y.Map<Y.Text>;
  assets: Y.Map<string>;
  typstProject: TypstProject;
}

/** Layout of one renderable page, in points (no SVG; rendered on demand). */
export interface PreviewPage {
  width: number;
  height: number;
}

export interface PreviewState {
  /** One entry per renderable page, in order. Layout only - SVG is rendered
   * lazily per page by `use-preview-render`. Null until the first compile. */
  pages: PreviewPage[] | null;
  /** Bumps on every successful compile; invalidates the per-page SVG cache. */
  version: number;
  /** Set on a failed compile *without* clearing `pages`, so the last-good
   * preview stays visible while the error is surfaced. */
  error: string | null;
}

interface ProjectContextValue {
  projectId: Accessor<string>;
  membership: ReturnType<typeof useProject>;
  collab: ReturnType<typeof useCollabDoc>;
  typst: ReturnType<typeof useTypstProject>;

  ready: Accessor<Ready | null>;
  /**
   * Page layout + version of the live preview. Owned here (not in PreviewPane)
   * so the compile subscription and the thumbnail cache share one source of
   * truth; SVG itself is rendered lazily per visible page in PreviewPane.
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
  /** blob_id -> font family name, parsed lazily as fonts load. */
  fontFamilies: Record<string, string>;

  editorView: Accessor<EditorView | null>;
  setEditorView: (view: EditorView | null) => void;
  jumpToRemoteUser: (clientId: number) => void;
  /** Open `file` and move the caret to a 1-based line/column. */
  gotoSource: (file: string, line: number, column: number) => void;

  diagnostics: Accessor<Diagnostic[]>;
  errorCount: Accessor<number>;
  /**
   * True once the preview output is trustworthy: the project has either compiled
   * cleanly, or produced an error *after* all assets/fonts finished loading into
   * the VFS. Until then, compiles report not-yet-loaded assets as missing files,
   * so those transient diagnostics are hidden behind a loading state.
   */
  previewReady: Accessor<boolean>;
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

  // Latches true once the initial assets *and* fonts are in the VFS. Used to
  // trigger the one authoritative compile that settles the preview (see below).
  const [resourcesReady, setResourcesReady] = createSignal(false);
  let assetsReady = false;
  let fontsReady = false;
  const markResourcesReady = () => {
    if (assetsReady && fontsReady) setResourcesReady(true);
  };

  useAssetsSync(
    projectId,
    () => typst.project,
    () => collab.assets,
    () => {
      assetsReady = true;
      markResourcesReady();
    }
  );

  // blob_id -> family name, parsed once by useFontsSync from the bytes it already
  // fetched; the fonts panel reads this instead of refetching/reparsing.
  const [fontFamilies, setFontFamilies] = createStore<Record<string, string>>({});
  useFontsSync(
    projectId,
    () => typst.project,
    () => collab.fonts,
    (blobId, family) => {
      setFontFamilies(blobId, family);
    },
    () => {
      fontsReady = true;
      markResourcesReady();
    }
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

  // Track page layout (dimensions) + a version counter per compile. The actual
  // SVG is rendered lazily, per visible page, by PreviewPane's render hook, so
  // editing a long document no longer re-rasterizes every page.
  const [preview, setPreview] = createStore<PreviewState>({
    pages: null,
    version: 0,
    error: null,
  });
  // Drives the loading state and gates the error surfaces, so transient
  // missing-file errors during the initial asset/font load stay hidden. Latches
  // true from a trustworthy result: a clean compile (below), or the authoritative
  // post-resource compile (further below) for a document that never compiles
  // cleanly. Never flipped by an errored compile during load.
  const [previewReady, setPreviewReady] = createSignal(false);
  let lastStored: string | undefined;
  createEffect(() => {
    const project = typst.project;
    // Reset on project swap so a new document doesn't show the old layout.
    setPreview({ pages: null, version: 0, error: null });
    setPreviewReady(false);
    lastStored = undefined;
    if (!project) return;
    const off = project.onCompile((result) => {
      // useTypstProject replaces the project on file change; a late listener
      // from the previous project must not touch the current state.
      if (typst.project !== project) return;
      const errorMessage = result.diagnostics.find((d) => d.severity === "error")?.message;
      if (errorMessage) {
        // Keep the last-good `pages` so the preview stays visible; just surface
        // the error. `result.pages` is stale on a failed compile.
        setPreview("error", errorMessage);
      } else {
        // Successful compile: replace layout and bump the version, which
        // invalidates the per-page SVG cache in the render hook.
        setPreview(
          produce((s) => {
            s.pages = result.pages.map((p) => ({ width: p.width, height: p.height }));
            s.version += 1;
            s.error = null;
          })
        );
      }
      // A clean compile produced pages, so it's trustworthy. An errored compile
      // is NOT trusted here: during load it may just be a not-yet-loaded asset
      // (transient "file not found"). Genuinely-broken documents are revealed by
      // the authoritative compile below.
      if (!errorMessage) setPreviewReady(true);
    });
    onCleanup(off);
  });

  // Once every asset/font has been written into the VFS, run one compile whose
  // result is guaranteed to see them: the engine's worker queue is FIFO, so a
  // compile issued after all `setBinary`/`addFont` round-trips is ordered after
  // them. That makes this result authoritative - any error now is real, not a
  // not-yet-loaded asset - so we trust the preview from here on, even for a
  // genuinely-broken document that never compiles cleanly.
  createEffect(() => {
    if (!resourcesReady()) return;
    const project = typst.project;
    if (!project) return;
    void (async () => {
      await project.compile();
      if (typst.project === project) setPreviewReady(true);
    })();
  });

  // Refresh the dashboard thumbnail from page 1. The preview no longer renders
  // every page, so render page 0 explicitly here; it rarely changes, so only
  // write when its rendered SVG actually differs.
  createEffect(() => {
    const project = typst.project;
    const version = preview.version;
    if (!project || version === 0) return;
    if ((preview.pages?.length ?? 0) === 0) return;
    void (async () => {
      try {
        const svg = await project.renderPage(0);
        // Drop a render that resolved after a project swap or a newer compile.
        if (typst.project !== project || preview.version !== version) return;
        if (!svg || svg === lastStored) return;
        lastStored = svg;
        await storeThumbnail(projectId(), svg);
      } catch {
        // Thumbnails are best-effort; a render failure just skips this update.
      }
    })();
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

  // Switch to `file`, then (once the view has swapped) move the caret to the
  // 1-based line/column. Shared by the diagnostics list and preview click-to-source.
  const gotoSource = (file: string, line: number, column: number) => {
    setRequestedFile(file);
    queueMicrotask(() => {
      const view = editorView();
      if (!view) return;
      const doc = view.state.doc;
      const lineInfo = doc.line(Math.min(Math.max(line, 1), doc.lines));
      const from = Math.min(lineInfo.from + column - 1, lineInfo.to);
      view.dispatch({
        selection: { anchor: from },
        effects: EditorView.scrollIntoView(from, { y: "center" }),
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
    fontFamilies,
    editorView,
    setEditorView,
    jumpToRemoteUser,
    gotoSource,
    diagnostics,
    errorCount,
    previewReady,
  };

  return <ProjectContext.Provider value={value}>{props.children}</ProjectContext.Provider>;
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjectContext must be used inside ProjectProvider");
  return ctx;
}
