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
import { useProjectContext } from "./ProjectContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProjectSettingsDialog(props: Props) {
  const ctx = useProjectContext();

  // Y.Maps aren't Solid-reactive; mirror the keys into a signal via observe()
  // so the dropdown updates when files are added/removed/renamed.
  const [paths, setPaths] = createSignal<string[]>([]);
  createEffect(() => {
    const files = ctx.collab.files;
    if (!files) {
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

  // List of .typ files eligible to be the entry. Asset files (images, PDFs)
  // can't be Typst sources.
  const typFiles = createMemo<string[]>(() =>
    paths()
      .filter((p) => p.endsWith(".typ"))
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
        <div class="grid gap-4 pt-2">
          <div class="grid gap-2">
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
              The file compiled into the preview. Changing it affects every collaborator. Use
              right-click → Preview this file for a local-only override.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
