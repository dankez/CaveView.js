import type { ParsedCave } from '@shared/types';

export function hasUsefulPointColors(colors: Float32Array | undefined, pointCount: number): boolean {
  if (!colors || colors.length < pointCount * 3) return false;
  let nonZero = 0;
  let nonWhite = 0;
  let samples = 0;
  const sampleStep = Math.max(1, Math.floor(pointCount / 2000));
  for (let i = 0; i < pointCount; i += sampleStep) {
    samples++;
    const p = i * 3;
    const r = colors[p];
    const g = colors[p + 1];
    const b = colors[p + 2];
    if (r > 0.01 || g > 0.01 || b > 0.01) nonZero++;
    if (Math.abs(r - 1) > 0.01 || Math.abs(g - 1) > 0.01 || Math.abs(b - 1) > 0.01) nonWhite++;
    if (nonZero > 8 && nonWhite > 8) return true;
  }
  const threshold = Math.max(1, Math.min(8, Math.floor(samples * 0.05)));
  return nonZero >= threshold && nonWhite >= threshold;
}

export function hasRenderablePointColors(cave: ParsedCave, pointCount = cave.pointCount): boolean {
  if (!cave.pointColors || cave.pointColors.length < pointCount * 3) return false;
  if (cave.hasPointColors === false) return false;
  if (typeof cave.hasUsablePointColors === 'boolean') return cave.hasUsablePointColors;
  return hasUsefulPointColors(cave.pointColors, pointCount);
}
