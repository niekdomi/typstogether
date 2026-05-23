import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { isTypFile } from "../../lib/paths";
import { useProjectContext } from "./ProjectContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProjectSettingsDialog(props: Props) {
  const ctx = useProjectContext();

  // Y.Maps aren't Solid-reactive; mirror the keys into a signal via observe()
  // so the dropdown updates when files change. Only observe while the dialog is
  // open, no point tracking file edits when nobody's looking at the dropdown.
  const [paths, setPaths] = createSignal<string[]>([]);
  createEffect(() => {
    const files = ctx.collab.files;
    if (!props.open || !files) {
      setPaths([]);
      return;
    }
    const refresh = () => {
      setPaths([...files.keys()]);
    };
    refresh();
    files.observe(refresh);
    onCleanup(() => {
      files.unobserve(refresh);
    });
  });

  const typFiles = createMemo<string[]>(() =>
    paths()
      .filter((p) => isTypFile(p))
      .toSorted()
  );

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open: boolean) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>Project-wide options shared by all collaborators.</DialogDescription>
        </DialogHeader>
        <div class="grid gap-2 pt-2">
          <label for="settings-entry" class="text-sm font-medium">
            Entry file
          </label>
          <Select<string>
            value={ctx.collab.entry}
            onChange={(path) => {
              if (path) ctx.collab.setEntry(path);
            }}
            options={typFiles()}
            disabled={ctx.isReadOnly()}
            itemComponent={(itemProps) => (
              <SelectItem item={itemProps.item}>{itemProps.item.rawValue}</SelectItem>
            )}
          >
            <SelectTrigger id="settings-entry" aria-label="Entry file">
              <SelectValue<string>>{(state) => state.selectedOption()}</SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
          <p class="text-muted-foreground text-xs">
            The file compiled into the preview. Changing it affects every collaborator. Use the eye
            toggle in the file list for a local-only preview.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
