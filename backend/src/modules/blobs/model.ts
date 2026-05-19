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

// Elysia's `t.File({ type: [...] })` uses the `file-type` package to byte-sniff,
// which has zero support for text-based formats (rejects `.svg`, `.txt`, etc.).
// MIME is instead validated in the service against `ALLOWED_MIME_TYPES`.
export const blobUploadModel = t.Object({
  file: t.File({ maxSize: MAX_BLOB_SIZE }),
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
  "blob.meta": blobMetaModel,
  "blob.byIdParams": blobByIdParamsModel,
};

export type BlobMeta = typeof blobMetaModel.static;
export type BlobByIdParams = typeof blobByIdParamsModel.static;
