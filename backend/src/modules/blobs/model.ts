import { t } from "elysia";

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/svg+xml",
  "image/webp",
  "application/pdf",
] as const;

export const MAX_BLOB_SIZE = "10m"; // 10MB;
export const MAX_FONT_SIZE = "30m"; // 30MB; covers most CJK fonts.

// The engine's `addFont` registers only TTF/OTF/TTC. file-type can detect more
// (WOFF/WOFF2), so the service filters font uploads to these.
export const FONT_MIMES = new Set(["font/ttf", "font/otf", "font/collection"]);

// Elysia's `t.File({ type: [...] })` uses the `file-type` package to byte-sniff,
// which has zero support for text-based formats (rejects `.svg`, `.txt`, etc.).
// MIME is instead validated in the service: assets against `ALLOWED_MIME_TYPES`,
// fonts against `FONT_MIMES` (where byte-sniffing fonts is exactly what we want).
export const blobUploadModel = t.Object({
  file: t.File({ maxSize: MAX_BLOB_SIZE }),
});

export const fontUploadModel = t.Object({
  file: t.File({ maxSize: MAX_FONT_SIZE }),
});

export const blobMetaModel = t.Object({
  id: t.String(),
  mime: t.String(),
  size: t.Number(),
});

export const blobByIdParamsModel = t.Object({
  id: t.String(),
  blobId: t.String({ format: "uuid" }),
});

export const blobModels = {
  "blob.upload": blobUploadModel,
  "font.upload": fontUploadModel,
  "blob.meta": blobMetaModel,
  "blob.byIdParams": blobByIdParamsModel,
};

export type BlobMeta = typeof blobMetaModel.static;
export type BlobByIdParams = typeof blobByIdParamsModel.static;
