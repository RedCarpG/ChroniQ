/** Shared all-sky map units: centre and horizon radius. */
export const C = 200
export const R = 170

// The map: the horizon is the rim (radius R), the zenith the centre (C, C), altitude falling off
// evenly outwards. North is up and east is LEFT, as when looking up at the sky.
export const project = (az: number, alt: number): [number, number] => {
  const r = (R * (90 - alt)) / 90
  const a = (az * Math.PI) / 180
  return [C - r * Math.sin(a), C - r * Math.cos(a)]
}

/** The half below one's feet reverses east/west and altitude. */
export const projectSky = (az: number, alt: number, below: boolean): [number, number] =>
  below ? project((360 - az) % 360, -alt) : project(az, alt)

/** SVG path data through the projected points */
export const pathData = (points: { az: number; alt: number }[], pt: (az: number, alt: number) => [number, number] = project) =>
  points.map((p, i) => `${i ? 'L' : 'M'}${pt(p.az, p.alt).map((v) => v.toFixed(1)).join(' ')}`).join('')

export interface Label {
  key: string
  text: string
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
  kind: 'body' | 'star' | 'figure'
}

/**
 * Places names beside their points without overlapping (k: map units per
 * screen pixel, as the text keeps its size on screen): each tries right,
 * left, above and below its point, and takes the first spot that is free.
 * Bodies go first (brightest first), then named stars; a star name with no
 * free spot is left off.
 */
export function placeLabels(points: { key: string; text: string; x: number; y: number; r: number; kind: Label['kind'] }[], k: number) {
  const boxes: [number, number, number, number][] = []
  const labels: Label[] = []
  for (const p of points) {
    // The font sizes in styles.css (.sky-body-name etc.), in map units
    const size = (p.kind === 'body' ? 13 : p.kind === 'figure' ? 11.5 : 11) * k
    // A Chinese character is about one em wide, a Latin letter about 0.6 of that
    const w = [...p.text].reduce((sum, ch) => sum + (ch.charCodeAt(0) < 0x2e80 ? 0.62 : 1), 0) * size
    const h = size + 2 * k
    const gap = 4 * k
    const spots: [number, number, Label['anchor'], number][] = [
      [p.x + p.r + gap, p.y, 'start', p.x + p.r + gap],
      [p.x - p.r - gap, p.y, 'end', p.x - p.r - gap - w],
      [p.x, p.y - p.r - h / 2 - gap, 'middle', p.x - w / 2],
      [p.x, p.y + p.r + h / 2 + gap, 'middle', p.x - w / 2],
    ]
    const spot = spots.find(([, y, , left]) => {
      const box: [number, number, number, number] = [left, y - h / 2, left + w, y + h / 2]
      return !boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])
    })
    if (!spot && p.kind !== 'body') continue
    const [x, y, anchor, left] = spot ?? spots[0]
    boxes.push([left, y - h / 2, left + w, y + h / 2])
    labels.push({ key: p.key, text: p.text, x, y, anchor, kind: p.kind })
  }
  return labels
}


