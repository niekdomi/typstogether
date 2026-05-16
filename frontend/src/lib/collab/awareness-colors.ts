// 1/φ (conjugate of the golden ratio φ = 1.618). Multiplying a hash by this
// and taking mod 1 distributes hues maximally far apart on the color wheel.
const GOLDEN_RATIO_CONJUGATE = 0.618_033_988_749_895;

/** Returns a deterministic HSL color pair for a user, consistent across all projects. */
export function userColor(userId: string): { color: string; colorLight: string } {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = Math.trunc(hash * 31 + (userId.codePointAt(i) ?? 0));
  }

  const hue = Math.round(((hash * GOLDEN_RATIO_CONJUGATE) % 1) * 360).toString();
  return {
    color: `hsl(${hue} 65% 55%)`,
    colorLight: `hsl(${hue} 65% 55% / 20%)`,
  };
}
