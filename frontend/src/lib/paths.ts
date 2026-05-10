// The same logical file lives at two addresses:
// - `MAIN_FILE` — Y.Text key inside the Y.Doc (no leading slash, by Yjs convention).
// - `MAIN_PATH` — Typst VFS path (leading slash, per `@vedivad/typst-web-service`).
// Keep both in sync when changing the canonical filename.
export const MAIN_FILE = "main.typ";
export const MAIN_PATH = `/${MAIN_FILE}`;
