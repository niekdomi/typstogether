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

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".eot": "application/vnd.ms-fontobject",
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".tgz": "application/gzip",
  ".bz2": "application/x-bzip2",
  ".7z": "application/x-7z-compressed",
};

export interface BinaryTemplateFile {
  bytes: Uint8Array;
  mime: string;
}

export interface TemplateFiles {
  /** Path -> file content. Keyed by Typst VFS path (leading slash). */
  text: Map<string, string>;
  /** Path -> raw bytes + best-effort MIME for the assets Y.Map / project_blob. */
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

/**
 * Fetches a Typst Universe package and returns the contents of its template
 * subdirectory. Text-allowlisted files come back as strings; everything else
 * (images, fonts, archives, …) comes back as bytes with a best-effort MIME so
 * the caller can persist it as a project blob.
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
        mime: MIME_BY_EXTENSION[ext] ?? "application/octet-stream",
      });
    }
  }
  return { text, binary };
}
