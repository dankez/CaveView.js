/**
 * Therion .th2 parser
 */
export interface Th2Point { x: number; y: number; name: string }
export interface Th2Line { type: string; points: { x: number; y: number }[] }
export interface Th2Scrap { name: string; lines: Th2Line[]; points: Th2Point[] }

export function parseTh2(text: string): Th2Scrap[] {
  const lines = text.split('\n')
  const scraps: Th2Scrap[] = []
  let currentScrap: Th2Scrap | null = null

  for (let line of lines) {
    line = line.trim()
    if (line.startsWith('scrap')) {
      const name = line.split(/\s+/)[1] || `scrap_${scraps.length}`
      currentScrap = { name, lines: [], points: [] }
      scraps.push(currentScrap)
    } else if (line.startsWith('endscrap')) {
      currentScrap = null
    } else if (currentScrap) {
      if (line.startsWith('line')) {
        const type = line.split(/\s+/)[1] || 'wall'
        currentScrap.lines.push({ type, points: [] })
      } else if (line.startsWith('point')) {
        const parts = line.split(/\s+/)
        const x = parseFloat(parts[1]), y = parseFloat(parts[2])
        const name = parts[4] || ''
        if (!isNaN(x) && !isNaN(y)) currentScrap.points.push({ x, y, name })
      } else if (/^-?\d+\.?\d*/.test(line)) {
        const parts = line.split(/\s+/)
        const x = parseFloat(parts[0]), y = parseFloat(parts[1])
        if (!isNaN(x) && !isNaN(y) && currentScrap.lines.length > 0) {
          currentScrap.lines[currentScrap.lines.length - 1].points.push({ x, y })
        }
      }
    }
  }
  return scraps
}
