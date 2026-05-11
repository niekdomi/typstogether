import { Show } from "solid-js";

import { leafOf } from "../../../lib/paths";
import ConfirmDialog from "../../dashboard/ConfirmDialog";
import PromptDialog from "../../dashboard/PromptDialog";
import type { FileSidebarController } from "./use-file-sidebar";

const dropSlash = (p: string) => p.replace(/^\//, "");

interface Props {
  sb: FileSidebarController;
}

export default function Dialogs(props: Props) {
  const renameFileDialog = props.sb.dialogOf("renameFile");
  const duplicateFileDialog = props.sb.dialogOf("duplicateFile");
  const deleteFileDialog = props.sb.dialogOf("deleteFile");
  const newFileDialog = props.sb.dialogOf("newFile");
  const newFolderDialog = props.sb.dialogOf("newFolder");
  const renameFolderDialog = props.sb.dialogOf("renameFolder");
  const deleteFolderDialog = props.sb.dialogOf("deleteFolder");

  return (
    <>
      <Show when={renameFileDialog()}>
        {(s) => (
          <PromptDialog
            open
            onClose={props.sb.close}
            onSubmit={(name) => props.sb.handleRenameFile(s().path, name)}
            title="Rename file"
            label="File name"
            initialValue={leafOf(s().path)}
            submitLabel="Rename"
          />
        )}
      </Show>

      <Show when={duplicateFileDialog()}>
        {(s) => (
          <PromptDialog
            open
            onClose={props.sb.close}
            onSubmit={(name) => props.sb.handleDuplicateFile(s().path, name)}
            title="Duplicate file"
            label="New file name"
            initialValue={leafOf(s().path)}
            submitLabel="Duplicate"
          />
        )}
      </Show>

      <Show when={deleteFileDialog()}>
        {(s) => (
          <ConfirmDialog
            open
            onClose={props.sb.close}
            onConfirm={() => {
              props.sb.handleDeleteFile(s().path);
            }}
            title="Delete file"
            message={`Delete "${leafOf(s().path)}"? This cannot be undone.`}
            confirmLabel="Delete"
            danger
          />
        )}
      </Show>

      <Show when={newFileDialog()}>
        {(s) => (
          <PromptDialog
            open
            onClose={props.sb.close}
            onSubmit={(name) => props.sb.handleNewFile(s().dir, name)}
            title={s().dir ? `New file in ${dropSlash(s().dir)}` : "New file"}
            label="File name"
            initialValue=""
            submitLabel="Create"
          />
        )}
      </Show>

      <Show when={newFolderDialog()}>
        {(s) => (
          <PromptDialog
            open
            onClose={props.sb.close}
            onSubmit={(name) => props.sb.handleNewFolder(s().dir, name)}
            title={s().dir ? `New folder in ${dropSlash(s().dir)}` : "New folder"}
            label="Folder name"
            initialValue=""
            submitLabel="Create"
          />
        )}
      </Show>

      <Show when={renameFolderDialog()}>
        {(s) => (
          <PromptDialog
            open
            onClose={props.sb.close}
            onSubmit={(name) => props.sb.handleRenameFolder(s().path, name)}
            title="Rename folder"
            label="Folder name"
            initialValue={leafOf(s().path)}
            submitLabel="Rename"
          />
        )}
      </Show>

      <Show when={deleteFolderDialog()}>
        {(s) => (
          <ConfirmDialog
            open
            onClose={props.sb.close}
            onConfirm={() => {
              props.sb.handleDeleteFolder(s().path);
            }}
            title="Delete folder"
            message={`Delete "${leafOf(s().path)}" and all files inside it? This cannot be undone.`}
            confirmLabel="Delete"
            danger
          />
        )}
      </Show>
    </>
  );
}
