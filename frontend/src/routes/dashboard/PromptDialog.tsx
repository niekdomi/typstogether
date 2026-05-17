import { createEffect, createSignal, Show } from "solid-js";

import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { TextField, TextFieldInput, TextFieldLabel } from "../../components/ui/text-field";

interface PromptDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Handle the submitted value. Return a string to display as an inline error
   * and keep the dialog open; return `undefined` on success, the dialog will
   * close itself.
   */
  onSubmit: (value: string) => string | undefined;
  title: string;
  label: string;
  initialValue?: string;
  submitLabel?: string;
}

export default function PromptDialog(props: PromptDialogProps) {
  const [value, setValue] = createSignal(props.initialValue ?? "");
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (props.open) {
      setValue(props.initialValue ?? "");
      setError(null);
    }
  });

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
            const message = props.onSubmit(trimmed);
            if (message) {
              setError(message);
              return;
            }
            props.onClose();
          }}
          class="flex flex-col gap-4"
        >
          <TextField
            value={value()}
            onChange={(v) => {
              setValue(v);
              if (error()) setError(null);
            }}
          >
            <TextFieldLabel>{props.label}</TextFieldLabel>
            <TextFieldInput autofocus type="text" />
          </TextField>
          <Show when={error()}>{(msg) => <p class="text-destructive text-sm">{msg()}</p>}</Show>
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
