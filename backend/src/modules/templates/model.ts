import { t } from "elysia";

export const templateModel = t.Object({
  id: t.String(),
  version: t.String(),
  description: t.String(),
  authors: t.Array(t.String()),
  categories: t.Array(t.String()),
  thumbnailUrl: t.Nullable(t.String()),
});

export type Template = typeof templateModel.static;
