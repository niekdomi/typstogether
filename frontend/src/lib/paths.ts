// Files are addressed by Typst VFS path (leading slash, per
// `@vedivad/typst-web-service`). The Y.Map of files uses these paths as keys.
export const MAIN_PATH = "/main.typ";
export const FILES_KEY = "files";

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
    if (seg === "" || seg === ".") continue;
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
export function normalizeFile(input: string, dir = ""): string {
  let name = input.trim();
  if (!name) return "";
  if (!name.endsWith(".typ")) name += ".typ";
  const raw = name.startsWith("/") ? name : joinPath(dir, name);
  return resolvePath(raw);
}

/** Normalize a user-entered folder name into a folder path under `dir`.
 * Supports relative jumping: "../sibling" resolves from `dir`.
 * Returns "" if the input is empty or resolves to root. */
export function normalizeFolder(input: string, dir = ""): string {
  const name = input.trim().replace(/\/+$/, "");
  if (!name) return "";
  const raw = name.startsWith("/") ? name : joinPath(dir, name);
  const resolved = resolvePath(raw);
  return resolved === "/" ? "" : resolved;
}
