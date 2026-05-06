import { TbOutlineX } from "solid-icons/tb";
import { createSignal } from "solid-js";

import Modal from "./Modal";

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
    <Modal open={props.open} onClose={props.onClose} labelledBy="prompt-title">
      <header class="modal-header">
        <h2 id="prompt-title" class="display modal-title">
          {props.title}
        </h2>
        <button type="button" class="modal-close" onClick={props.onClose} aria-label="Close">
          <TbOutlineX size={16} />
        </button>
      </header>
      <form
        class="modal-body"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = value().trim();
          if (!trimmed) return;
          props.onSubmit(trimmed);
          props.onClose();
        }}
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
        <footer class="modal-footer">
          <button type="button" class="btn" onClick={props.onClose}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={!value().trim()}>
            {props.submitLabel ?? "Save"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
