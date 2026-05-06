import { TbOutlineX } from "solid-icons/tb";

import Modal from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Modal open={props.open} onClose={props.onClose} labelledBy="confirm-title">
      <header class="modal-header">
        <h2 id="confirm-title" class="display modal-title">
          {props.title}
        </h2>
        <button type="button" class="modal-close" onClick={props.onClose} aria-label="Close">
          <TbOutlineX size={16} />
        </button>
      </header>
      <div class="modal-body">
        <p class="modal-message">{props.message}</p>
        <footer class="modal-footer">
          <button type="button" class="btn" onClick={props.onClose}>
            Cancel
          </button>
          <button
            type="button"
            class={`btn ${props.danger ? "btn-danger" : "btn-primary"}`}
            onClick={() => {
              props.onConfirm();
              props.onClose();
            }}
          >
            {props.confirmLabel ?? "Confirm"}
          </button>
        </footer>
      </div>
    </Modal>
  );
}
