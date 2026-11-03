// Clouds over the 天象 map, from the forecast's cover at the moment shown (lib/weather.ts): a deck of
// cloud at a height, seen from below and projected as the map projects the sky (so the clouds bunch
// up towards the horizon, where one looks through more of them), its shapes from a tiling noise and
// as much of it filled in as the cover says. The wind carries it: the deck moves with the hours, so
// turning the time drifts the clouds across. Night clouds are dark, lit grey by a bright Moon, and
// their undersides glow orange over a town (the light pollution setting); by day they are white.
import { C, R } from './skyPaint'

const SIZE = 256
let noise: Float32Array | null = null
/** A tiling cloud texture: value noise over four octaves, 0–1, made once */
function cloudNoise() {
  if (noise) return noise
  let seed = 1337
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const out = new Float32Array(SIZE * SIZE)
  let total = 0
  for (const [cells, weight] of [
    [4, 0.5],
    [8, 0.25],
    [16, 0.15],
    [32, 0.1],
  ] as const) {
    const grid = Float32Array.from({ length: cells * cells }, rand)
    total += weight
    for (let y = 0; y < SIZE; y++) {
      const gy = (y / SIZE) * cells
      const y0 = Math.floor(gy)
      const fy = gy - y0
      const sy = fy * fy * (3 - 2 * fy)
      for (let x = 0; x < SIZE; x++) {
        const gx = (x / SIZE) * cells
        const x0 = Math.floor(gx)
        const fx = gx - x0
        const sx = fx * fx * (3 - 2 * fx)
        const at = (i: number, j: number) => grid[(j % cells) * cells + (i % cells)]
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx
        const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx
        out[y * SIZE + x] += (top + (bottom - top) * sy) * weight
      }
    }
  }
  for (let i = 0; i < out.length; i++) out[i] /= total
  noise = out
  return out
}
/** The texture at a point (any real coordinates; it repeats every SIZE), read between its texels */
function sample(n: Float32Array, x: number, y: number) {
  const fx = x - Math.floor(x)
  const fy = y - Math.floor(y)
  const x0 = ((Math.floor(x) % SIZE) + SIZE) % SIZE
  const y0 = ((Math.floor(y) % SIZE) + SIZE) % SIZE
  const x1 = (x0 + 1) % SIZE
  const y1 = (y0 + 1) % SIZE
  const top = n[y0 * SIZE + x0] + (n[y0 * SIZE + x1] - n[y0 * SIZE + x0]) * fx
  const bottom = n[y1 * SIZE + x0] + (n[y1 * SIZE + x1] - n[y1 * SIZE + x0]) * fx
  return top + (bottom - top) * fy
}

export interface CloudScene {
  width: number
  height: number
  /** Map to screen, as skyPaint's */
  ox: number
  oy: number
  scale: number
  below: boolean
  /** Cover, 0–1, and how much of it is low cloud (denser, darker) */
  cover: number
  low: number
  /** The wind: km/h, and where from (degrees); and the moment, ms, to carry the deck along */
  wind: number
  windFrom: number
  time: number
  /** The light on them: 'night' (with the Moon's brightness 0–1 and the town's glow 0–1), 'twilight' or 'day' */
  light: 'night' | 'twilight' | 'day'
  moon: number
  town: number
}

/** Quarter size: soft enough for clouds */
const Q = 4
/** How far the deck reaches, in the texture's units per unit of its height above us */
const SPREAD = 22

export function paintClouds(canvas: HTMLCanvasElement, s: CloudScene | null) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const [w, h] = [Math.ceil(s ? s.width / Q : 1), Math.ceil(s ? s.height / Q : 1)]
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  } else ctx.clearRect(0, 0, w, h)
  if (!s || s.cover <= 0.02) return
  canvas.style.width = `${w * Q}px`
  canvas.style.height = `${h * Q}px`
  const n = cloudNoise()
  const image = ctx.createImageData(w, h)
  const px = image.data
  const [cx, cy] = [s.ox + C * s.scale, s.oy + C * s.scale]
  const rPix = R * s.scale
  // The deck drifts downwind: km travelled, in texture units (a deck about 2 km up)
  const hours = s.time / 3600_000
  const drift = ((s.wind * hours) / 2 / SPREAD) * 6
  const toward = ((s.windFrom + 180) * Math.PI) / 180
  const [dx, dy] = [Math.sin(toward) * drift, Math.cos(toward) * drift]
  // Filled where the noise is above this: more cover, lower threshold
  const edge = 1 - s.cover
  const base =
    s.light === 'day'
      ? [236, 240, 246]
      : s.light === 'twilight'
        ? [120, 116, 140]
        : [26 + 70 * s.moon, 30 + 72 * s.moon, 42 + 70 * s.moon]
  const glow = s.light === 'night' ? s.town : 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const mx = (x + 0.5) * Q - cx
      const my = (y + 0.5) * Q - cy
      const r = Math.hypot(mx, my) / rPix
      if (r > 1) continue
      // Back to the sky: altitude from the distance from the middle, azimuth from the direction
      const alt = Math.max(2, 90 * (1 - r))
      const az = Math.atan2(s.below ? mx : -mx, -my)
      // Where that line of sight meets the deck
      const d = (SPREAD / Math.tan((alt * Math.PI) / 180)) * 1.2
      const u = d * Math.sin(az) + dx
      const v = d * Math.cos(az) + dy
      const val = sample(n, u * 2.4, v * 2.4) * 0.75 + sample(n, u * 9, v * 9) * 0.25
      // Low in the sky, one looks through more of the deck
      const thick = Math.min(1, (val - edge + 0.18) / 0.32 + (1 - alt / 90) * 0.35 * s.cover)
      if (thick <= 0) continue
      const a = Math.min(0.94, thick * (0.7 + 0.3 * s.low))
      const lowGlow = glow * (0.4 + 0.6 * (1 - alt / 90))
      // Thicker parts darker underneath (lighter by day), so even an overcast sky has its shapes
      const shade = s.light === 'day' ? 1.05 - 0.25 * (val - 0.5) : 1.15 - 0.9 * (val - 0.35)
      const i = (y * w + x) * 4
      px[i] = (base[0] + 120 * lowGlow) * shade
      px[i + 1] = (base[1] + 70 * lowGlow) * shade
      px[i + 2] = (base[2] + 30 * lowGlow) * shade
      px[i + 3] = a * 255
    }
  }
  ctx.putImageData(image, 0, 0)
}
