import * as THREE from 'three'

export const ELEV_STOPS: [number, [number, number, number]][] = [
  [0.00, [0.08, 0.18, 0.65]], // Deep Blue
  [0.18, [0.10, 0.48, 0.85]], // Blue
  [0.35, [0.12, 0.78, 0.72]], // Cyan
  [0.50, [0.18, 0.87, 0.38]], // Green
  [0.65, [0.80, 0.94, 0.10]], // Yellow
  [0.80, [0.97, 0.60, 0.05]], // Orange
  [1.00, [0.88, 0.10, 0.10]], // Red
]

export function elevColor(t: number): THREE.Color {
  const clampedT = Math.max(0, Math.min(1, t))
  for (let i = 0; i < ELEV_STOPS.length - 1; i++) {
    const [t0, c0] = ELEV_STOPS[i]
    const [t1, c1] = ELEV_STOPS[i + 1]
    if (clampedT >= t0 && clampedT <= t1) {
      const f = (clampedT - t0) / (t1 - t0)
      return new THREE.Color(
        c0[0] + f * (c1[0] - c0[0]),
        c0[1] + f * (c1[1] - c0[1]),
        c0[2] + f * (c1[2] - c0[2]),
      )
    }
  }
  return new THREE.Color(0.88, 0.10, 0.10)
}

export function normZ(z: number, minZ: number, maxZ: number): number {
  return maxZ === minZ ? 0.5 : Math.max(0, Math.min(1, (z - minZ) / (maxZ - minZ)))
}
