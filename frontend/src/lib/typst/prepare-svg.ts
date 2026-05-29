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
    const response = await fetch(href, { credentials: "include" });
    if (!response.ok) return null;
    return await blobToDataUrl(await response.blob());
  } catch (error) {
    console.warn("[thumbnail] failed to inline", href, error);
    return null;
  }
}

// Make the renderer SVG self-contained so the stored thumbnail doesn't depend on
// runtime sub-resource fetches.
export async function prepareSvgForStorage(raw: string): Promise<string> {
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
