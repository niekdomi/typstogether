import type * as Y from "yjs";

export type FlatNode =
  | { kind: "file"; path: string; depth: number; name: string }
  | { kind: "folder"; path: string; depth: number; name: string; collapsed: boolean };

export type ConflictFlow = "renameFile" | "duplicateFile" | "newFile" | "moveFile";

export type DialogState =
  | { type: "renameFile"; path: string }
  | { type: "duplicateFile"; path: string }
  | { type: "deleteFile"; path: string }
  | { type: "newFile"; dir: string }
  | { type: "newFolder"; dir: string }
  | { type: "renameFolder"; path: string }
  | { type: "deleteFolder"; path: string }
  | { type: "conflict"; proposedPath: string; sourcePath: string; flow: ConflictFlow };

export interface FileSidebarProps {
  files: Y.Map<Y.Text>;
  activeFile: () => string;
  setActiveFile: (path: string) => void;
}
