// Files are addressed by Typst VFS path (leading slash, per
// `@vedivad/typst-web-service`). The Y.Map of files uses these paths as keys.
export const MAIN_PATH = "/main.typ";
export const FILES_KEY = "files";

/** The directory part of a path. Root is the empty string. */
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

/** Normalize a user-entered file name into a Typst VFS path under `dir`. */
export function normalizeFile(input: string, dir = ""): string {
  let name = input.trim();
  if (!name) return "";
  if (!name.endsWith(".typ")) name += ".typ";
  // Allow nested input: "utils/helpers.typ" creates an implicit subfolder.
  if (name.startsWith("/")) return name;
  return joinPath(dir, name);
}

/** Normalize a user-entered folder name into a folder path under `dir`. */
export function normalizeFolder(input: string, dir = ""): string {
  const name = input.trim().replace(/\/+$/, "");
  if (!name) return "";
  if (name.startsWith("/")) return name;
  return joinPath(dir, name);
}
