export type FlatNode =
  | { kind: "file"; path: string; depth: number; name: string }
  | { kind: "folder"; path: string; depth: number; name: string; collapsed: boolean };

export type DialogState =
  | { type: "renameFile"; path: string }
  | { type: "duplicateFile"; path: string }
  | { type: "deleteFile"; path: string }
  | { type: "newFile"; dir: string }
  | { type: "newFolder"; dir: string }
  | { type: "renameFolder"; path: string }
  | { type: "deleteFolder"; path: string };
