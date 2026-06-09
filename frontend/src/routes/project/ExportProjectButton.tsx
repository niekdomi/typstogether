import { strToU8, zipSync } from "fflate";
import { TbOutlineFileZip } from "solid-icons/tb";
import { createSignal } from "solid-js";
import { toast } from "somoto";

import { Button } from "../../components/ui/button";
import { blobUrl } from "../../lib/assets/upload";
import { useProjectContext } from "./ProjectContext";

export default function ExportProjectButton() {
  const ctx = useProjectContext();
  const [busy, setBusy] = createSignal(false);

  const filename = (): string => {
    const raw = ctx.membership()?.project.name ?? "project";
    // Strip characters that browsers/OSes reject in download names
    const sanitizedFilename = raw.replaceAll(/[/\\?%*:|"<>]/g, "-").trim() || "project";
    return `${sanitizedFilename}.zip`;
  };

  const onClick = async () => {
    const ready = ctx.ready();
    if (!ready) return;
    const fonts = ctx.collab.fonts;
    if (ready.files.size === 0 && ready.assets.size === 0 && (fonts?.size ?? 0) === 0) {
      toast.error("Nothing to export yet.");
      return;
    }
    setBusy(true);
    try {
      // Text files come straight from the live Y.Doc. Binary blobs (assets and
      // registered fonts) are fetched by id. Asset paths are Typst VFS paths, kept
      // verbatim. Fonts go under `fonts/` so `typst --font-path fonts` finds them.
      const entries: Record<string, Uint8Array> = {};
      for (const [path, text] of ready.files) {
        entries[path] = strToU8(text.toJSON());
      }
      const fontBlobs = [...(fonts?.entries() ?? [])].map(([name, blobId]): [string, string] => [
        `fonts/${name}`,
        blobId,
      ]);
      const id = ctx.projectId();
      await Promise.all(
        [...ready.assets, ...fontBlobs].map(async ([path, blobId]) => {
          const res = await fetch(blobUrl(id, blobId), { credentials: "include" });
          if (!res.ok) throw new Error(`blob ${blobId}: ${String(res.status)}`);
          entries[path] = new Uint8Array(await res.arrayBuffer());
        })
      );

      const url = URL.createObjectURL(new Blob([zipSync(entries)], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename();
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export project failed:", error);
      toast.error("Could not export project.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title={busy() ? "Exporting…" : "Export project (.zip)"}
      aria-label="Export project"
      disabled={busy() || !ctx.ready()}
      onClick={() => {
        void onClick();
      }}
    >
      <TbOutlineFileZip />
    </Button>
  );
}
