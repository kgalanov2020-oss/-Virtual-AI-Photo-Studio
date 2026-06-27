export const PRODUCT_IMAGES_PER_STUDIO = 40;
export const TARGET_SHOTS_PER_STUDIO = 40;
export const TARGET_VARIATIONS_PER_SHOT = 1;

export function getTargetShots<T>(shots: T[]) {
  return shots.slice(0, TARGET_SHOTS_PER_STUDIO);
}

export function getTargetVariationCount(shot: { variations: number }) {
  return Math.min(Math.max(shot.variations, 1), TARGET_VARIATIONS_PER_SHOT);
}

export function isTargetVariation(variationIndex: number) {
  return variationIndex >= 1 && variationIndex <= TARGET_VARIATIONS_PER_SHOT;
}
