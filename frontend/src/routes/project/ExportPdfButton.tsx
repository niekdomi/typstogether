import { TbOutlineDownload } from "solid-icons/tb";
import { createSignal } from "solid-js";
import { toast } from "somoto";

import { Button } from "../../components/ui/button";
import { useProjectContext } from "./ProjectContext";

export default function ExportPdfButton() {
  const ctx = useProjectContext();
  const [busy, setBusy] = createSignal(false);

  const filename = (): string => {
    const raw = ctx.membership()?.project.name ?? "project";
    // Strip characters that browsers/OSes reject in download names
    const sanitizedFilename = raw.replaceAll(/[/\\?%*:|"<>]/g, "-").trim() || "project";
    return `${sanitizedFilename}.pdf`;
  };

  const onClick = async () => {
    const project = ctx.typst.project;
    if (!project) return;
    setBusy(true);
    try {
      const bytes = await project.compilePdf();
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: "application/pdf" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = filename();
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export PDF failed:", error);
      toast.error("Could not export PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title={busy() ? "Exporting…" : "Export PDF"}
      aria-label="Export PDF"
      disabled={busy() || !ctx.typst.project}
      onClick={() => {
        void onClick();
      }}
    >
      <TbOutlineDownload />
    </Button>
  );
}
