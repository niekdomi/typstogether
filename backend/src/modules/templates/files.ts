import { extname } from "node:path";

import { TOML } from "bun";
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

// Pulls `[template].path` from the package's typst.toml if present.
function readTemplatePath(entries: ParsedTarFileItem[]): string | null {
  const toml = entries.find((e) => e.name === "typst.toml" || e.name.endsWith("/typst.toml"));
  if (!toml) return null;
  let parsed: unknown;
  try {
    parsed = TOML.parse(toml.text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const template = (parsed as Record<string, unknown>)["template"];
  if (typeof template !== "object" || template === null) return null;
  const path = (template as Record<string, unknown>)["path"];
  return typeof path === "string" ? path : null;
}

// Sniff first (trust the bytes), then fall back to the mime-db extension
// table (covers text-shaped formats like SVG that have no magic number), then
// give up and call it opaque.
async function detectMime(bytes: Uint8Array, filename: string): Promise<string> {
  const sniffed = await fileTypeFromBuffer(bytes);
  return sniffed?.mime ?? (lookupMime(filename) || "application/octet-stream");
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
    if (TEXT_EXTENSIONS.has(extname(relPath).toLowerCase())) {
      text.set(path, entry.text);
    } else {
      binary.set(path, {
        bytes: entry.data,
        mime: await detectMime(entry.data, relPath),
      });
    }
  }
  return { text, binary };
}
