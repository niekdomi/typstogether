import { t } from "elysia";

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/svg+xml",
  "image/webp",
] as const;

export const MAX_BLOB_SIZE = "10m";

export const blobUploadModel = t.Object({
  file: t.File({ type: [...ALLOWED_MIME_TYPES], maxSize: MAX_BLOB_SIZE }),
});

export const blobMetaModel = t.Object({
  sha256: t.String(),
  mime: t.String(),
  size: t.Number(),
});

export const blobByShaParamsModel = t.Object({
  id: t.String(),
  sha256: t.String({ pattern: "^[a-f0-9]{64}$" }),
});

export const blobModels = {
  "blob.upload": blobUploadModel,
  "blob.meta": blobMetaModel,
  "blob.byShaParams": blobByShaParamsModel,
};

export type BlobMeta = typeof blobMetaModel.static;
export type BlobByShaParams = typeof blobByShaParamsModel.static;
