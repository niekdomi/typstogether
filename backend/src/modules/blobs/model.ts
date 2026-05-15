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
