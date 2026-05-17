import { gunzipSync } from "bun";

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

interface TarEntry {
  name: string;
  bytes: Uint8Array;
}

function isAllZero(slice: Uint8Array): boolean {
  for (const byte of slice) if (byte !== 0) return false;
  return true;
}

function readCString(
  buf: Uint8Array,
  offset: number,
  length: number,
  decoder: TextDecoder
): string {
  const slice = buf.subarray(offset, offset + length);
  let end = 0;
  while (end < slice.length && slice[end] !== 0) end++;
  return decoder.decode(slice.subarray(0, end));
}

// Minimal ustar reader: parses 512-byte headers, yields regular files.
// Format reference: https://www.gnu.org/software/tar/manual/html_node/Standard.html
function* readTar(buf: Uint8Array): Generator<TarEntry> {
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    if (isAllZero(header)) break;

    const name = readCString(header, 0, 100, decoder);
    const sizeStr = readCString(header, 124, 12, decoder).trim();
    const size = Number.parseInt(sizeStr, 8) || 0;
    const typeFlag = String.fromCodePoint(header[156] ?? 0);
    const prefix = readCString(header, 345, 155, decoder);
    const fullName = prefix ? `${prefix}/${name}` : name;

    offset += 512;
    // Regular file: typeFlag "0", "\0" (older format), or empty.
    if (typeFlag === "0" || typeFlag === "\0" || typeFlag === "") {
      yield { name: fullName, bytes: buf.subarray(offset, offset + size) };
    }
    // Content is padded up to a 512-byte boundary.
    offset += Math.ceil(size / 512) * 512;
  }
}

// Pulls `[template].path` from the package's typst.toml if present. We only
// need the path, so a regex is enough.
function readTemplatePath(entries: TarEntry[]): string | null {
  const toml = entries.find((e) => e.name === "typst.toml" || e.name.endsWith("/typst.toml"));
  if (!toml) return null;
  const text = new TextDecoder().decode(toml.bytes);
  const inTemplateSection = /\[template\][\s\S]*?(?=\n\[|$)/.exec(text);
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
  const gzipped = new Uint8Array(await res.arrayBuffer());
  const tar = gunzipSync(gzipped);
  const entries = [...readTar(tar)];

  const templateDir = readTemplatePath(entries) ?? "template";
  const prefix = `${templateDir}/`;

  const files = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.name.startsWith(prefix)) continue;
    const relPath = entry.name.slice(prefix.length);
    if (!relPath || relPath.endsWith("/")) continue;
    const dot = relPath.lastIndexOf(".");
    const ext = dot === -1 ? "" : relPath.slice(dot).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    files.set(`/${relPath}`, new TextDecoder().decode(entry.bytes));
  }
  return { files };
}
