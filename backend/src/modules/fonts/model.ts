import { t } from "elysia";

export const MAX_FONT_SIZE = "30m"; // 30MB; covers most CJK fonts.

export const fontUploadModel = t.Object({
  file: t.File({ maxSize: MAX_FONT_SIZE }),
});

export const fontModels = {
  "font.upload": fontUploadModel,
};

// The engine's `addFont` only registers TTF/OTF/TTC. file-type can also detect
// WOFF/WOFF2, so we filter to these even though they're all "fonts".
export const FONT_MIMES = new Set(["font/ttf", "font/otf", "font/collection"]);
