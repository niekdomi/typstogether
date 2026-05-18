import { fileTypeFromBuffer } from "file-type";
import { lookup as lookupMime } from "mime-types";
import { parseTarGzip, type ParsedTarFileItem } from "nanotar";

import { BadGatewayError } from "../../errors";

const PACKAGE_URL = (id: string, version: string) =>
  `https://packages.typst.org/preview/${id}-${version}.tar.gz`;

// Extensions that we surface as collaborative Y.Text documents. Everything
// else under the template directory is treated as a binary asset and stored in
// project_blob, with its path mapped via the assets Y.Map. SVG counts as binary
// here so it lines up with how user-uploaded SVGs are handled (rendered via
// <img>, not edited).
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

export interface BinaryTemplateFile {
  bytes: Uint8Array;
  mime: string;
}

export interface TemplateFiles {
  /** Path -> file content. Keyed by Typst VFS path (leading slash). */
  text: Map<string, string>;
  /** Path -> raw bytes + sniffed MIME for the assets Y.Map / project_blob. */
  binary: Map<string, BinaryTemplateFile>;
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

function extOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot).toLowerCase();
}

// Sniff first (trust the bytes), then fall back to the mime-db extension
// table (covers text-shaped formats like SVG that have no magic number), then
// give up and call it opaque.
async function detectMime(bytes: Uint8Array, ext: string): Promise<string> {
  const sniffed = await fileTypeFromBuffer(bytes);
  if (sniffed) return sniffed.mime;
  const byExt = ext ? lookupMime(ext) : false;
  return byExt || "application/octet-stream";
}

/**
 * Fetches a Typst Universe package and returns the contents of its template
 * subdirectory. Text-allowlisted files come back as strings; everything else
 * (images, fonts, archives, ...) comes back as bytes with a MIME sniffed via
 * `file-type` (falling back to the extension for text-shaped binaries like SVG).
 */
export async function fetchTemplateFiles(id: string, version: string): Promise<TemplateFiles> {
  const pkg = await fetch(PACKAGE_URL(id, version));
  if (!pkg.ok) {
    throw new BadGatewayError(
      `Failed to fetch template ${id}@${version}: HTTP ${String(pkg.status)}`
    );
  }
  const entries = await parseTarGzip(await pkg.arrayBuffer());

  const templateDir = readTemplatePath(entries) ?? "template";
  const prefix = `${templateDir}/`;

  const text = new Map<string, string>();
  const binary = new Map<string, BinaryTemplateFile>();

  for (const entry of entries) {
    if (entry.type !== "file" || !entry.data) continue;
    if (!entry.name.startsWith(prefix)) continue;
    const relPath = entry.name.slice(prefix.length);
    if (!relPath) continue;
    const path = `/${relPath}`;
    const ext = extOf(relPath);
    if (TEXT_EXTENSIONS.has(ext)) {
      text.set(path, entry.text);
    } else {
      binary.set(path, {
        bytes: entry.data,
        mime: await detectMime(entry.data, ext),
      });
    }
  }
  return { text, binary };
}
