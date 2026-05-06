import { createSignal } from "solid-js";

import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

interface PromptDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  label: string;
  initialValue?: string;
  submitLabel?: string;
}

export default function PromptDialog(props: PromptDialogProps) {
  const [value, setValue] = createSignal(props.initialValue ?? "");

  return (
    <Dialog
      open={props.open}
      onOpenChange={(o) => {
        if (!o) props.onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = value().trim();
            if (!trimmed) return;
            props.onSubmit(trimmed);
            props.onClose();
          }}
          class="flex flex-col gap-4"
        >
          <label class="modal-field">
            <span class="smallcaps">{props.label}</span>
            <input
              autofocus
              type="text"
              value={value()}
              onInput={(e) => setValue(e.currentTarget.value)}
            />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={props.onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value().trim()}>
              {props.submitLabel ?? "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
