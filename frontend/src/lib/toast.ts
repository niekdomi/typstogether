import { createSignal } from "solid-js";

export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

const DURATION_MS = 4000;

const [toasts, setToasts] = createSignal<Toast[]>([]);
let nextId = 0;

export { toasts };

export function dismissToast(id: number): void {
  setToasts(toasts().filter((t) => t.id !== id));
}

function pushToast(message: string, kind: ToastKind): void {
  nextId += 1;
  const id = nextId;
  setToasts([...toasts(), { id, message, kind }]);
  setTimeout(() => {
    dismissToast(id);
  }, DURATION_MS);
}

export const toast = {
  info(message: string): void {
    pushToast(message, "info");
  },
  success(message: string): void {
    pushToast(message, "success");
  },
  error(message: string): void {
    pushToast(message, "error");
  },
};
