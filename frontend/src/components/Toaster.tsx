import { TbOutlineX } from "solid-icons/tb";
import { For } from "solid-js";
import { Portal } from "solid-js/web";

import { dismissToast, toasts } from "../lib/toast";

export default function Toaster() {
  return (
    <Portal>
      <div class="toaster" role="status" aria-live="polite">
        <For each={toasts()}>
          {(t) => (
            <div class={`toast toast-${t.kind}`}>
              <span class="toast-message">{t.message}</span>
              <button
                type="button"
                class="toast-close"
                aria-label="Dismiss"
                onClick={() => {
                  dismissToast(t.id);
                }}
              >
                <TbOutlineX size={12} />
              </button>
            </div>
          )}
        </For>
      </div>
    </Portal>
  );
}
