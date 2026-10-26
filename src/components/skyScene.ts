import type { milkyWayAt } from '../lib/sky'
import type { SkyCanvasScene } from './skyPaint'
import { R, projectSky } from './skyGeometry'

/** Project and group the Milky Way's physical model into canvas strokes. */
export function buildMilkyWayBand(galaxy: ReturnType<typeof milkyWayAt>, below: boolean): SkyCanvasScene['band'] {
  const at = (az: number, alt: number) => projectSky(az, alt, below)
  const seen = (alt: number) => (below ? alt < 4 : alt > -4)
  // Sizes are in degrees: R / 90 map units to the degree
  const deg = R / 90
  const line = (list: typeof galaxy.rift) =>
    list
      .map((p, i) => {
        const [x, y] = at(p.az, p.alt)
        return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join('')
  const strokes = (list: typeof galaxy.spine) => {
    const out: { d: string; w: number; a: number }[] = []
    for (let i = 0; i < list.length; i++) {
      const p = list[i]
      const q = list[(i + 1) % list.length]
      // Leave out what is well below the horizon (and so far outside the disc)
      if (below ? Math.min(p.alt, q.alt) > 30 : Math.max(p.alt, q.alt) < -30) continue
      const [x1, y1] = at(p.az, p.alt)
      const [x2, y2] = at(q.az, q.alt)
      out.push({
        d: `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`,
        w: (((p.size ?? 4) + (q.size ?? 4)) / 2) * deg,
        a: (p.weight + q.weight) / 2,
      })
    }
    return out
  }
  // Each layer as a few paths rather than a stroke each: strokes of about the same opacity (to
  // 0.02) and width (to half a unit) share one path, which under the blur looks the same
  const layer = (band: { d: string; w: number; a: number }[], width: number, opacity: (a: number) => number) => {
    const groups = new Map<string, { d: string; w: number; o: number }>()
    for (const b of band) {
      const o = Math.round(opacity(b.a) * 50) / 50
      if (o <= 0) continue
      const w = Math.round(b.w * width * 2) / 2
      const key = `${o} ${w}`
      const g = groups.get(key)
      if (g) g.d += b.d
      else groups.set(key, { d: b.d, w, o })
    }
    return [...groups.values()]
  }
  // Brightness runs about 0.2 (anticentre) to 1.6 (the centre, in Sagittarius)
  const band = strokes(galaxy.spine)
  return {
    haze: layer(band, 3.4, (a) => Math.min(0.3, 0.08 + 0.13 * a)),
    body: layer(band, 1.7, (a) => Math.min(0.5, 0.08 + 0.26 * a)),
    core: layer(band, 0.75, (a) => (a > 0.55 ? Math.min(0.6, 0.5 * (a - 0.55)) : 0)),
    // The rift as continuous lines (separate strokes would bead): a thin one along its whole
    // length and a wider one where it is deepest, Aquila to Cygnus
    rift: [
      { d: line(galaxy.rift), w: 2.6 * deg, o: 0.55 },
      { d: line(galaxy.rift.filter((p) => p.l >= 18 && p.l <= 72)), w: 4.5 * deg, o: 0.5 },
    ],
    // The rift's own patches would bead along its line: only the Coalsack stays a patch
    dust: galaxy.dust
      .filter((p) => p.l > 180 && seen(p.alt))
      .map((p) => {
        const [x, y] = at(p.az, p.alt)
        return { x, y, r: ((p.size ?? 4) * R) / 90, a: p.weight }
      }),
  }
}
