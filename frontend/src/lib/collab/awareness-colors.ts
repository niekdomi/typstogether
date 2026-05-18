// 1/1.618 (conjugate of the golden ratio). Multiplying a hash by this and
// taking mod 1 distributes hues maximally far apart on the color wheel.
const GOLDEN_RATIO_CONJUGATE = 0.618_033_988_7;

/** Returns a deterministic HSL color pair for a user, consistent across all projects. */
export function userColor(userId: string): { color: string; colorLight: string } {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash *= 31;
    hash += userId.codePointAt(i) ?? 0;
  }

  // Multiply by 360 because HSL uses degrees.
  const hue = Math.round(((hash * GOLDEN_RATIO_CONJUGATE) % 1) * 360).toString();
  return {
    color: `hsl(${hue} 65% 55%)`,
    colorLight: `hsl(${hue} 65% 55% / 20%)`,
  };
}
