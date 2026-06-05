import { TbOutlineUpload } from "solid-icons/tb";

import { cx } from "./ui/cva";

interface UploadButtonProps {
  label: string;
  /** Number of uploads in flight; > 0 swaps the label for a progress count. */
  uploading: number;
  /** Highlight as a drop target (e.g. while a file is dragged over). */
  active: boolean;
  onClick: () => void;
  class?: string;
}

// Compact upload action for a panel header (file explorer, fonts): click to
// pick, lights up with a brand outline as a drop target, and shows upload
// progress. The transparent border reserves space so the drag-over outline
// doesn't shift layout.
export function UploadButton(props: UploadButtonProps) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      onClick={props.onClick}
      class={cx(
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-xs transition-colors",
        props.active
          ? "border-brand bg-sidebar-accent"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        props.class
      )}
    >
      <TbOutlineUpload size={14} classList={{ "animate-pulse": props.uploading > 0 }} />
      <span>{props.uploading > 0 ? `Uploading ${String(props.uploading)}…` : props.label}</span>
    </button>
  );
}
