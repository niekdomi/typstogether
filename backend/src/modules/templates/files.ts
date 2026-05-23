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
  /**
   * VFS path of the template's entrypoint (from `[template].entrypoint`),
   * with a leading slash. Null when the package didn't declare one - callers
   * should fall back to `/main.typ`.
   */
  entry: string | null;
}

interface TemplateMeta {
  /** Subdirectory inside the tarball that holds the template files. */
  path: string | null;
  /** Path of the entry file inside that subdirectory. */
  entrypoint: string | null;
}

// Pulls `[template]` metadata from the package's typst.toml. Returns nulls
// when the manifest is missing or malformed; callers apply defaults.
function readTemplateMeta(entries: ParsedTarFileItem[]): TemplateMeta {
  const empty: TemplateMeta = { path: null, entrypoint: null };
  const toml = entries.find((e) => e.name === "typst.toml" || e.name.endsWith("/typst.toml"));
  if (!toml) return empty;
  let parsed: unknown;
  try {
    parsed = TOML.parse(toml.text);
  } catch {
    return empty;
  }
  if (typeof parsed !== "object" || parsed === null) return empty;
  const template = (parsed as Record<string, unknown>)["template"];
  if (typeof template !== "object" || template === null) return empty;
  const t = template as Record<string, unknown>;
  return {
    path: typeof t["path"] === "string" ? t["path"] : null,
    entrypoint: typeof t["entrypoint"] === "string" ? t["entrypoint"] : null,
  };
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

  const meta = readTemplateMeta(entries);
  const templateDir = meta.path ?? "template";
  const prefix = `${templateDir}/`;
  // entrypoint is declared relative to the template subdir; we flatten the
  // subdir to project root so the resulting VFS path is just `/${entrypoint}`.
  const entry = meta.entrypoint ? `/${meta.entrypoint.replace(/^\//, "")}` : null;

  const text = new Map<string, string>();
  const binary = new Map<string, BinaryTemplateFile>();

  for (const item of entries) {
    if (item.type !== "file" || !item.data) continue;
    if (!item.name.startsWith(prefix)) continue;
    const relPath = item.name.slice(prefix.length);
    if (!relPath) continue;
    const path = `/${relPath}`;
    if (TEXT_EXTENSIONS.has(extname(relPath).toLowerCase())) {
      text.set(path, item.text);
    } else {
      binary.set(path, {
        bytes: item.data,
        mime: await detectMime(item.data, relPath),
      });
    }
  }
  return { text, binary, entry };
}
