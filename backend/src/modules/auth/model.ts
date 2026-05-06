import { t } from "elysia";

export const providerIdSchema = t.Union([
  t.Literal("github"),
  t.Literal("gitlab"),
  t.Literal("google"),
]);

export const providerModel = t.Object({
  id: providerIdSchema,
  name: t.String(),
});

export type ProviderId = typeof providerIdSchema.static;
