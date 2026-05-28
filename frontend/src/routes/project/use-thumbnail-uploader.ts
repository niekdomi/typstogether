import type { TypstProject } from "@vedivad/codemirror-typst";
import { createEffect, onCleanup } from "solid-js";

import { putThumbnail } from "../../lib/typst/thumbnail-cache";
import { renderer } from "../../lib/typst/use-typst-project";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("loadend", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FileReader produced a non-string result"));
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("FileReader failed"));
    });
    reader.readAsDataURL(blob);
  });
}

async function fetchAsDataUrl(href: string): Promise<string | null> {
  try {
    const res = await fetch(href, { credentials: "include" });
    if (!res.ok) return null;
    return await blobToDataUrl(await res.blob());
  } catch (error) {
    console.warn("[thumbnail] failed to inline", href, error);
    return null;
  }
}

// Make the renderer SVG self-contained so the stored thumbnail doesn't
// depend on runtime sub-resource fetches.
async function prepareSvgForStorage(raw: string): Promise<string> {
  const container = document.createElement("div");
  container.innerHTML = raw;
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("Typst renderer output had no <svg> element");

  // The renderer `<script>` body uses HTML-only entities (`&nbsp;`). The
  // dashboard loads this SVG via `<img>`, which strict-XML-parses and rejects
  // the whole document on undefined entities. Strip the script so the bytes
  // stay parseable.
  for (const s of svg.querySelectorAll("script")) s.remove();

  const cache = new Map<string, Promise<string | null>>();
  const fetchOnce = (href: string): Promise<string | null> => {
    let pending = cache.get(href);
    if (!pending) {
      pending = fetchAsDataUrl(href);
      cache.set(href, pending);
    }
    return pending;
  };

  await Promise.all(
    [...svg.querySelectorAll("image")].map(async (img) => {
      const href = img.getAttribute("href") ?? img.getAttribute("xlink:href");
      if (!href || href.startsWith("data:")) return;
      const dataUrl = await fetchOnce(href);
      if (!dataUrl) return;
      img.setAttribute("href", dataUrl);
      img.removeAttribute("xlink:href");
    })
  );

  return svg.outerHTML;
}

// Thumbnails are stored only on this device (IndexedDB), so a project shows a
// preview only where it has been opened. We capture on every compile and lean
// on the compiler's existing debounce for cadence rather than throttling here.
export function useThumbnailUploader(
  projectId: () => string,
  project: () => TypstProject | null,
  canEdit: () => boolean
) {
  createEffect(() => {
    const p = project();
    if (!p || !canEdit()) return;

    // Bound per activation so an in-flight capture can't write the old
    // project's content under a switched-to id.
    const id = projectId();

    const store = async (vector: Uint8Array): Promise<void> => {
      try {
        const pages = await renderer.renderSvgPages(vector);
        const svg = pages[0]?.svg;
        if (svg) await putThumbnail(id, await prepareSvgForStorage(svg));
      } catch (error) {
        console.error("Thumbnail capture failed:", error);
      }
    };

    if (p.lastResult?.vector) void store(p.lastResult.vector);

    const off = p.onCompile((result) => {
      if (result.vector) void store(result.vector);
    });
    onCleanup(off);
  });
}
