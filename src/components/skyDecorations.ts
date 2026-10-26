import { C, R, project } from './skyGeometry'

/** A small seeded random generator (mulberry32): the same hills and trees every time */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/** A ring of ground from the given inner line out far past any screen's corners (fill even-odd) */
const groundFrom = (inner: string) => `M${C - 4 * R} ${C}a${4 * R} ${4 * R} 0 1 0 ${8 * R} 0a${4 * R} ${4 * R} 0 1 0 ${-8 * R} 0Z${inner}`

/**
 * The skyline round the horizon, as an all-sky camera sees it: low rolling hills (half a degree
 * to two and a half up) with clumps of trees to six or seven degrees, then dark ground beyond.
 * In map units, made once.
 */
export const SKYLINE = (() => {
  const rand = seeded(20261024)
  const waves = [2, 3, 5, 9].map((f, i) => ({ f, a: [0.9, 0.6, 0.4, 0.25][i], p: rand() * Math.PI * 2 }))
  // Stands of trees, each a row of rounded crowns of their own sizes
  const trees: { az: number; w: number; h: number }[] = []
  for (let stand = 0; stand < 9; stand++) {
    let az = rand() * 360
    const count = 3 + Math.floor(rand() * 9)
    const tall = 2.5 + rand() * 3
    for (let i = 0; i < count; i++) {
      const w = 0.9 + rand() * 1.6
      trees.push({ az, w, h: tall * (0.7 + rand() * 0.45) })
      az += w * (0.9 + rand() * 0.6)
    }
  }
  const points: string[] = []
  for (let i = 0; i < 1440; i++) {
    const az = i / 4
    let h = 1.3 + waves.reduce((sum, w) => sum + w.a * Math.sin((az * w.f * Math.PI) / 180 + w.p), 0)
    for (const tree of trees) {
      const d = Math.abs(((az - tree.az + 540) % 360) - 180)
      if (d < tree.w) h = Math.max(h, tree.h * Math.sqrt(1 - (d / tree.w) ** 2))
    }
    const [x, y] = project(az, Math.max(0.3, h))
    points.push(`${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return groundFrom(`M${points.join('L')}Z`)
})()
/** Under one's feet there is no skyline: the ground starts at the horizon itself */
export const GROUND = groundFrom(`M${C - R} ${C}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z`)
/** Azimuth ticks just outside the horizon, every 5° (longer every 30°) */
export const TICKS = Array.from({ length: 72 }, (_, i) => {
  const a = (i * 5 * Math.PI) / 180
  const [r0, r1] = [R + 2, R + (i % 6 === 0 ? 9 : 5)]
  return `M${(C - r0 * Math.sin(a)).toFixed(1)} ${(C - r0 * Math.cos(a)).toFixed(1)}L${(C - r1 * Math.sin(a)).toFixed(1)} ${(C - r1 * Math.cos(a)).toFixed(1)}`
}).join('')
/** The sky's colours from the zenith (first) out to the horizon, by how much sunlight there is */
export const SKY_STOPS: Record<string, [number, string][]> = {
  night: [[0, '#02040d'], [0.55, '#050a1a'], [0.85, '#0a1128'], [1, '#141d3d']],
  twilight: [[0, '#0b1433'], [0.55, '#182553'], [0.85, '#2c3a6e'], [1, '#4a5486']],
  day: [[0, '#325a8c'], [0.7, '#4f78ab'], [1, '#8eaed0']],
  below: [[0, '#0b0806'], [0.7, '#15100c'], [1, '#221a14']],
}
/** The glow low in the sky all round (airglow, a town's light): its colour and strength */
export const HORIZON_GLOW: Record<string, [string, number]> = {
  night: ['#5a6eb0', 0.2],
  twilight: ['#7d84c4', 0.4],
  day: ['#e8f1ff', 0.26],
  below: ['#6a4a30', 0.25],
}
