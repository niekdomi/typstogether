import { parseTarGzip, type ParsedTarFileItem } from "nanotar";

import { BadGatewayError } from "../../errors";

const PACKAGE_URL = (id: string, version: string) =>
  `https://packages.typst.org/preview/${id}-${version}.tar.gz`;

// Files we'll surface as Y.Text. Anything else (images, fonts, archives) is
// skipped for now since binary assets need the blob-store path.
const TEXT_EXTENSIONS = new Set([
  ".typ",
  ".toml",
  ".bib",
  ".yml",
  ".yaml",
  ".md",
  ".txt",
  ".json",
  ".csv",
  ".cls",
  ".sty",
]);

export interface TemplateFiles {
  /** Map keyed by Typst VFS path (leading slash). Values are file contents. */
  files: Map<string, string>;
}

// Pulls `[template].path` from the package's typst.toml if present. We only
// need the path, so a regex is enough.
function readTemplatePath(entries: ParsedTarFileItem[]): string | null {
  const toml = entries.find((e) => e.name === "typst.toml" || e.name.endsWith("/typst.toml"));
  if (!toml) return null;
  const inTemplateSection = /\[template\][\s\S]*?(?=\n\[|$)/.exec(toml.text);
  if (!inTemplateSection) return null;
  const pathMatch = /path\s*=\s*"([^"]+)"/.exec(inTemplateSection[0]);
  return pathMatch?.[1] ?? null;
}

/**
 * Fetches a Typst Universe package and returns the text files in its template
 * subdirectory. The template path defaults to "template" but is taken from the
 * package's `typst.toml` when present.
 */
export async function fetchTemplateFiles(id: string, version: string): Promise<TemplateFiles> {
  const res = await fetch(PACKAGE_URL(id, version));
  if (!res.ok) {
    throw new BadGatewayError(
      `Failed to fetch template ${id}@${version}: HTTP ${String(res.status)}`
    );
  }
  const entries = await parseTarGzip(await res.arrayBuffer());

  const templateDir = readTemplatePath(entries) ?? "template";
  const prefix = `${templateDir}/`;

  const files = new Map<string, string>();
  for (const entry of entries) {
    if (entry.type !== "file" || !entry.data) continue;
    if (!entry.name.startsWith(prefix)) continue;
    const relPath = entry.name.slice(prefix.length);
    if (!relPath) continue;
    const dot = relPath.lastIndexOf(".");
    const ext = dot === -1 ? "" : relPath.slice(dot).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    files.set(`/${relPath}`, entry.text);
  }
  return { files };
}
