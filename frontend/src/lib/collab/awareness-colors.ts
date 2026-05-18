// Deterministic HSL color pair for a user. Same userId → same colors everywhere.
export function userColor(userId: string): { color: string; colorLight: string } {
  // Mod after each step keeps the running value tiny, no overflow worries,
  // and the distribution across hues is uniform enough for cursor colors.
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + (userId.codePointAt(i) ?? 0)) % 360;
  }
  const hue = hash.toString();
  return {
    color: `hsl(${hue} 65% 55%)`,
    colorLight: `hsl(${hue} 65% 55% / 20%)`,
  };
}
