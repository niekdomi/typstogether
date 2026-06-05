import { t } from "elysia";

export const MAX_FONT_SIZE = "30m"; // 30MB; covers most CJK fonts.

export const fontUploadModel = t.Object({
  file: t.File({ maxSize: MAX_FONT_SIZE }),
});

export const fontModels = {
  "font.upload": fontUploadModel,
};

// Sniff TTF/OTF/TTC by magic number — the browser-supplied MIME for fonts is
// unreliable (often empty or application/octet-stream). Returns a normalized
// mime, or null if the bytes aren't a font the engine's `addFont` can register.
// WOFF/WOFF2 are intentionally rejected since `addFont` only takes TTF/OTF/TTC.
export function sniffFontMime(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  // Big-endian sfnt version tag from the first 4 bytes. Valid font magics all
  // have a high byte < 0x80, so the signed result stays positive and matches.
  const tag =
    ((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0);
  switch (tag) {
    case 0x00_01_00_00: // TrueType outlines
    case 0x74_72_75_65: {
      // "true"
      return "font/ttf";
    }
    case 0x4f_54_54_4f: {
      // "OTTO" — OpenType with CFF outlines
      return "font/otf";
    }
    case 0x74_74_63_66: {
      // "ttcf" — TrueType collection
      return "font/collection";
    }
    default: {
      return null;
    }
  }
}
