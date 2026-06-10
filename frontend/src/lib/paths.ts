// Y.Doc wire-protocol constants are shared with the backend; see
// @typstogether/shared. Path-manipulation helpers below are frontend-only.
export {
  ASSETS_KEY,
  ENTRY_KEY,
  FILES_KEY,
  FONTS_KEY,
  MAIN_PATH,
  META_KEY,
} from "@typstogether/shared";

/** Whether a path is a Typst source file (the only kind eligible as a compile entry). */
export function isTypFile(path: string): boolean {
  return path.endsWith(".typ");
}

// Text files a Typst project meaningfully uses, beyond `.typ` source: `.bib`
// (BibTeX) and `.yml`/`.yaml` (Hayagriva) bibliographies, `.csl` citation
// styles, the `csv`/`json`/`toml`/`yaml`/`xml` data loaders, and plain text via
// `read()`. These live as `Y.Text` in the files map (the Y.Doc is their source
// of truth), unlike binary assets/fonts which take the blob store. `.svg` is
// excluded on purpose - it is wired as an image asset; `.cbor` is binary.
const TEXT_EXTENSIONS = new Set([
  ".typ",
  ".txt",
  ".toml",
  ".bib",
  ".csl",
  ".csv",
  ".json",
  ".yaml",
  ".yml",
  ".xml",
  ".md",
]);

/**
 * Whether a file name/path ends in a recognized text extension
 * (`TEXT_EXTENSIONS`). Drives upload routing (text -> files map, binary -> blob
 * store) and the New File `.typ` default.
 */
export function hasTextExtension(name: string): boolean {
  const dot = name.lastIndexOf(".");
  return dot !== -1 && TEXT_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

// Text files are stored inline in the persisted, synced Y.Doc, so they get a
// tighter cap than blobs (`MAX_BLOB_SIZE`, 10MB) to keep the doc from bloating.
export const MAX_TEXT_FILE_SIZE = 2 * 1024 * 1024; // 2MB

/** The directory part of a path. Returns "" for root-level paths, which is falsy and acts as the loop terminator when walking ancestors. */
export function dirOf(path: string): string {
  return path.split("/").slice(0, -1).join("/");
}

/** The leaf (basename) of a path. */
export function leafOf(path: string): string {
  return path.split("/").at(-1)!;
}

/** Join a directory and a leaf into a full path. */
export function joinPath(dir: string, leaf: string): string {
  return dir ? `${dir}/${leaf}` : `/${leaf}`;
}

/**
 * Resolve an absolute path by collapsing `.` and `..` segments.
 * `..` at root is silently absorbed (cannot go above `/`).
 */
function resolvePath(path: string): string {
  const segments: string[] = [];
  for (const seg of path.split("/")) {
    if (seg === "" || seg === ".") {
      continue;
    }

    if (seg === "..") {
      segments.pop(); // no-op on empty array - clamps at root
    } else {
      segments.push(seg);
    }
  }

  return "/" + segments.join("/");
}

/** Normalize a user-entered file name into a Typst VFS path under `dir`.
 * Supports relative jumping: "../../other.typ" resolves from `dir`. */
export function normalizeFile(input: string, dir: string): string {
  let name = input.trim().replace(/\/+$/, "");
  if (!name) {
    return "";
  }
  // Bare names default to `.typ`; an already-recognized text extension (e.g.
  // `refs.bib`, `data.toml`) is preserved so the New File dialog can create
  // non-`.typ` text files directly.
  if (!hasTextExtension(name)) {
    name += ".typ";
  }

  const raw = name.startsWith("/") ? name : joinPath(dir, name);
  return resolvePath(raw);
}

/** Normalize an asset name into a Typst VFS path under `dir`, preserving its extension. */
export function normalizeAsset(input: string, dir: string): string {
  const name = input.trim();
  if (!name) return "";
  if (name.startsWith("/")) return name;
  return joinPath(dir, name);
}

/** Normalize a user-entered folder name into a folder path under `dir`. */
export function normalizeFolder(input: string, dir: string): string {
  const name = input.trim().replace(/\/+$/, "");
  if (!name) {
    return "";
  }

  const raw = name.startsWith("/") ? name : joinPath(dir, name);
  const resolved = resolvePath(raw);
  return resolved === "/" ? "" : resolved;
}
