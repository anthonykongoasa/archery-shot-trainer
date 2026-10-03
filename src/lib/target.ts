export const TARGET_OUTER_RADIUS = 1;

const ringBoundaries = [0.08, 0.17, 0.27, 0.37, 0.47, 0.58, 0.69, 0.8, 0.9, 1];
const scoringValues = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export function getArrowDistanceMm(x: number, y: number): number {
  return Math.sqrt(x * x + y * y) * 610;
}

export function getTargetRing(x: number, y: number): string {
  const distance = Math.sqrt(x * x + y * y);
  if (distance > TARGET_OUTER_RADIUS) return 'miss';
  for (let i = 0; i < ringBoundaries.length; i += 1) {
    if (distance <= ringBoundaries[i]) return `${scoringValues[i]}-ring`;
  }
  return 'miss';
}

export function scoreArrow(x: number, y: number): number {
  const distance = Math.sqrt(x * x + y * y);
  if (distance > TARGET_OUTER_RADIUS) return 0;

  for (let i = 0; i < ringBoundaries.length; i += 1) {
    if (distance <= ringBoundaries[i]) return scoringValues[i];
  }

  return 0;
}

export function clampNormalized(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function normalizePointFromPixels(px: number, py: number, width: number, height: number): { x: number; y: number } {
  const x = ((px / width) * 2 - 1) * 1.1;
  const y = ((1 - py / height) * 2 - 1) * 1.1;
  return {
    x: clampNormalized(x),
    y: clampNormalized(y),
  };
}
