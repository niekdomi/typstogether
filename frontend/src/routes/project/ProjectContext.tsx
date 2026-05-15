import type { EditorView } from "@codemirror/view";
import { useParams } from "@solidjs/router";
import type { DiagnosticMessage, TypstProject } from "@vedivad/codemirror-typst";
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
import type * as Y from "yjs";

import { useCollabDoc } from "../../lib/collab/use-collab-doc";
import { MAIN_PATH } from "../../lib/paths";
import { useProject } from "../../lib/projects/use-project";
import { useTypstProject } from "../../lib/typst/use-typst-project";

export interface Ready {
  files: Y.Map<Y.Text | Uint8Array>;
  typstProject: TypstProject;
}

interface ProjectContextValue {
  projectId: Accessor<string>;
  membership: ReturnType<typeof useProject>;
  collab: ReturnType<typeof useCollabDoc>;
  typst: ReturnType<typeof useTypstProject>;

  ready: Accessor<Ready | null>;
  activeFile: Accessor<string>;
  setActiveFile: (path: string) => void;
  isReadOnly: Accessor<boolean>;

  editorView: Accessor<EditorView | null>;
  setEditorView: (view: EditorView | null) => void;

  diagnostics: Accessor<DiagnosticMessage[]>;
  errorCount: Accessor<number>;
}

const ProjectContext = createContext<ProjectContextValue>();

export function ProjectProvider(props: { children: JSX.Element }) {
  const params = useParams<{ id: string }>();
  const projectId = () => params.id;

  const membership = useProject(projectId);
  const collab = useCollabDoc(projectId);
  const typst = useTypstProject(() => collab.files);

  const [requestedFile, setRequestedFile] = createSignal(MAIN_PATH);
  const [editorView, setEditorView] = createSignal<EditorView | null>(null);
  const [diagnostics, setDiagnostics] = createSignal<DiagnosticMessage[]>([]);

  const isReadOnly = () => membership()?.role === "viewer" || collab.readOnly;
  const errorCount = createMemo(
    () => diagnostics().filter((d) => (d.severity as string) === "error").length
  );

  const ready = createMemo<Ready | null>(() => {
    const files = collab.files;
    const typstProject = typst.project;
    return files && typstProject ? { files, typstProject } : null;
  });

  // Active file falls back to the first available if the requested one was
  // deleted (or never existed).
  const activeFile = createMemo(() => {
    const r = ready();
    if (!r) return MAIN_PATH;
    const requested = requestedFile();
    if (r.files.has(requested)) return requested;
    return [...r.files.keys()][0] ?? MAIN_PATH;
  });

  // Keep `requestedFile` in sync with `activeFile` so the sidebar's selection
  // reflects fallbacks (e.g. when the requested file is deleted).
  createEffect(() => {
    const a = activeFile();
    if (a !== requestedFile()) setRequestedFile(a);
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

  const value: ProjectContextValue = {
    projectId,
    membership,
    collab,
    typst,
    ready,
    activeFile,
    setActiveFile: setRequestedFile,
    isReadOnly,
    editorView,
    setEditorView,
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
