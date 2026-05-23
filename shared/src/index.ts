// Collaborative Y.Doc wire protocol shared by the frontend and backend. Both
// ends address the same document, so these keys must agree; this package is
// their single source of truth.

// Files are addressed by Typst VFS path (leading slash, per
// `@vedivad/typst-web-service`); the files Y.Map uses these paths as keys.
/** Default compile entry, and the seed file for blank projects. */
export const MAIN_PATH = "/main.typ";

// Top-level Y.Doc map keys.
export const FILES_KEY = "files";
export const ASSETS_KEY = "assets";
export const META_KEY = "meta";

/** Key under the `meta` Y.Map holding the project's compile entry path. */
export const ENTRY_KEY = "entry";
