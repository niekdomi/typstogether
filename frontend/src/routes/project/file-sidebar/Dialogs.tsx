import { Show } from "solid-js";

import { leafOf } from "../../../lib/paths";
import ConfirmDialog from "../../dashboard/ConfirmDialog";
import PromptDialog from "../../dashboard/PromptDialog";
import { useFileSidebarController } from "./FileSidebarContext";

const dropSlash = (p: string) => p.replace(/^\//, "");

export default function Dialogs() {
  const sb = useFileSidebarController();
  const renameFileDialog = sb.dialogOf("renameFile");
  const duplicateFileDialog = sb.dialogOf("duplicateFile");
  const deleteFileDialog = sb.dialogOf("deleteFile");
  const newFileDialog = sb.dialogOf("newFile");
  const newFolderDialog = sb.dialogOf("newFolder");
  const renameFolderDialog = sb.dialogOf("renameFolder");
  const deleteFolderDialog = sb.dialogOf("deleteFolder");

  return (
    <>
      <Show when={renameFileDialog()}>
        {(s) => (
          <PromptDialog
            open
            onClose={sb.close}
            onSubmit={(name) => sb.handleRenameFile(s().path, name)}
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
            onClose={sb.close}
            onSubmit={(name) => sb.handleDuplicateFile(s().path, name)}
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
            onClose={sb.close}
            onConfirm={() => {
              sb.handleDeleteFile(s().path);
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
            onClose={sb.close}
            onSubmit={(name) => sb.handleNewFile(s().dir, name)}
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
            onClose={sb.close}
            onSubmit={(name) => sb.handleNewFolder(s().dir, name)}
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
            onClose={sb.close}
            onSubmit={(name) => sb.handleRenameFolder(s().path, name)}
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
            onClose={sb.close}
            onConfirm={() => {
              sb.handleDeleteFolder(s().path);
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
