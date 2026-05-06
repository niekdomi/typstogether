import { Show, createEffect, onCleanup, type JSX } from "solid-js";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: JSX.Element;
  labelledBy?: string;
}

export default function Modal(props: ModalProps) {
  createEffect(() => {
    if (!props.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", handler);
    onCleanup(() => {
      document.removeEventListener("keydown", handler);
    });
  });

  return (
    <Show when={props.open}>
      <div
        class="modal-backdrop"
        onClick={props.onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") props.onClose();
        }}
        role="presentation"
      >
        <div
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={props.labelledBy}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {props.children}
        </div>
      </div>
    </Show>
  );
}
