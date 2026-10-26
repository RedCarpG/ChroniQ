// The 天象 page's sky on a canvas, under the map: the Milky Way (its glow, its star clouds and its
// dark lanes) and every star that is only looked at, down to magnitude 6. The map above keeps what
// can be pointed at (the bodies, the named stars, the figures). Drawn in screen pixels, so however
// far the map is zoomed the Milky Way's blur stays a few pixels and a star stays a point of light.

import { C, R } from './skyGeometry'
export { C, R } from './skyGeometry'

import { CLOUD_CELL, cloudLight } from '../lib/sky'

/** The stars' colours by B−V, soft as the eye sees them: blue-white to pale orange */
export const PALETTE = ['#bccdff', '#d6e1ff', '#f2f4ff', '#fff6e8', '#ffe9cf', '#ffd9b3', '#ffc79a']
export const colourIndex = (bv: number) =>
  bv < -0.1 ? 0 : bv < 0.15 ? 1 : bv < 0.45 ? 2 : bv < 0.75 ? 3 : bv < 1.1 ? 4 : bv < 1.5 ? 5 : 6
export const starColour = (bv: number) => PALETTE[colourIndex(bv)]
/**
 * A star as a point of light rather than a disc: brightest at the centre and falling off into a
 * glow, as a star looks through the air (the eye's, or a lens's, spread of a point). As gradient
 * stops: offset, how much white in the colour, opacity. The SVG's named stars use the same.
 */
export const PSF: [number, number, number][] = [
  [0, 1, 1],
  [0.1, 0.6, 1],
  [0.2, 0.25, 0.75],
  [0.34, 0, 0.3],
  [0.55, 0, 0.09],
  [0.8, 0, 0.025],
  [1, 0, 0],
]
/** A star's light: the radius its glow reaches (map units at the full view) and its strength, by magnitude */
export const glowRadius = (mag: number) => 2.2 * Math.max(0.42, 3.2 - 0.5 * mag)
export const starAlpha = (mag: number) => Math.min(1, Math.max(0.2, 1.12 - 0.14 * mag))

/** A colour ('#rrggbb') mixed with an amount of white */
export function mixWhite(hex: string, white: number) {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) =>
    Math.round(c + (255 - c) * white)
      .toString(16)
      .padStart(2, '0')
  return `#${mix(n >> 16)}${mix((n >> 8) & 255)}${mix(n & 255)}`
}

/** A star's picture in a colour at a size (device pixels across, odd, so its centre is a pixel's),
 *  drawn once: copied to the canvas as it is, much quicker than scaling a picture for every star */
const sprites = new Map<number, HTMLCanvasElement>()
function starSprite(colour: number, px: number) {
  const key = colour * 1000 + px
  let el = sprites.get(key)
  if (!el) {
    if (sprites.size > 800) sprites.clear()
    el = document.createElement('canvas')
    el.width = el.height = px
    const g = el.getContext('2d')
    if (g) {
      const grad = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2)
      for (const [offset, white, alpha] of PSF) {
        const c = parseInt(mixWhite(PALETTE[colour], white).slice(1), 16)
        grad.addColorStop(offset, `rgb(${c >> 16} ${(c >> 8) & 255} ${c & 255} / ${alpha})`)
      }
      g.fillStyle = grad
      g.fillRect(0, 0, px, px)
    }
    sprites.set(key, el)
  }
  return el
}

/** A stroke group of the Milky Way's band (SkyView's milkyWay), in map units */
export interface BandStroke {
  d: string
  w: number
  o: number
}
export interface SkyCanvasScene {
  /** The canvas's size on screen (CSS pixels) */
  width: number
  height: number
  /** Map to screen: x = ox + scale · map x */
  ox: number
  oy: number
  scale: number
  /** The map's zoom (1 fits the window) and its scale at that zoom */
  zoom: number
  fit: number
  /** The half of the sky beneath one's feet: the nadir in the middle, east and west swapped */
  below: boolean
  band: {
    haze: BandStroke[]
    body: BandStroke[]
    core: BandStroke[]
    rift: BandStroke[]
    dust: { x: number; y: number; r: number; a: number }[]
  }
  /** The Milky Way's star clouds (lib/sky.ts milkyWayCloud) where they stand now: their points (the
   *  first az.length of them, brightest first), and at the full view the cells they are gathered in */
  cloud: {
    az: Float32Array
    alt: Float32Array
    weight: Float32Array
    warm: Uint8Array
    cells: { az: Float32Array; alt: Float32Array; light: Float32Array; warm: Uint8Array } | null
  } | null
  /** The stars without a name, to magnitude 5 */
  stars: { az: number; alt: number; mag: number; bv: number }[]
  /** The stars past magnitude 6 (lib/sky.ts fieldStars) where they stand now */
  field: { az: Float32Array; alt: Float32Array; weight: Float32Array } | null
  /** The stars from magnitude 5 to 6, where they stand now, with their catalogue rows */
  faint: { az: Float32Array; alt: Float32Array; rows: readonly number[]; fields: number } | null
  /** How much of each shows: the Milky Way's strength, the stars' strength, the faintest star seen */
  light: { milkyWay: number; stars: number; limit: number }
  /** While the sky is dragged through time: the star clouds' points thinned out, to keep up */
  rough: boolean
  /** 流畅 (the 画质 option): drawn at the screen's CSS pixels, not its device pixels */
  lowRes?: boolean
}

/** Down to a quarter of the size for the blurs, which are soft enough not to show it */
const Q = 4
const DPR_MAX = 2
const RAD = Math.PI / 180
const BAND_COLOUR = { haze: '#7f8fc8', body: '#aab6e0', core: '#efe6d2' }
/** The star clouds' points: their brightness levels, and colours (bluish, and warm towards the bulge) */
const LEVELS = 4
const CLOUD_COLOUR = ['#cdd7ff', '#ffe3bf']
const FIELD_COLOUR = ['#e6ebff', '#fff0de']

const scratch = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()
/** The star clouds' points in order of colour and brightness level, so each takes one fill style */
const cloudOrder = new WeakMap<Float32Array, { order: Uint32Array; starts: number[] }>()
function orderOf(weight: Float32Array, warm: Uint8Array) {
  let o = cloudOrder.get(weight)
  if (!o) {
    const group = (i: number) => warm[i] * LEVELS + Math.min(LEVELS - 1, Math.floor(weight[i] * LEVELS))
    const counts = new Array(2 * LEVELS + 1).fill(0)
    for (let i = 0; i < weight.length; i++) counts[group(i) + 1]++
    for (let g = 1; g < counts.length; g++) counts[g] += counts[g - 1]
    const at = counts.slice()
    const order = new Uint32Array(weight.length)
    for (let i = 0; i < weight.length; i++) order[at[group(i)]++] = i
    o = { order, starts: counts }
    cloudOrder.set(weight, o)
  }
  return o
}

/** Blurs `from` into `into` (drawn with its current compositing): by filter, or where the browser
 *  cannot filter a canvas (Safari before 18) by the image's shadow, cast from far off */
function blurInto(into: CanvasRenderingContext2D, from: HTMLCanvasElement, px: number, colour: string) {
  if ('filter' in into) {
    into.filter = `blur(${px.toFixed(2)}px)`
    into.drawImage(from, 0, 0)
    into.filter = 'none'
  } else {
    const off = from.width + 50
    const ctx = into as CanvasRenderingContext2D
    ctx.shadowColor = colour
    ctx.shadowBlur = 2 * px
    ctx.shadowOffsetX = off
    ctx.drawImage(from, -off, 0)
    ctx.shadowColor = 'transparent'
  }
}

/**
 * Draws the sky: the Milky Way's glow to `glow`, a canvas a quarter of the size that the page shows
 * scaled up (so the browser scales it, not the script), and the points of light to `canvas`.
 */
export function paintSky(canvas: HTMLCanvasElement, glow: HTMLCanvasElement, s: SkyCanvasScene) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = s.lowRes ? 1 : Math.min(DPR_MAX, window.devicePixelRatio || 1)
  const [w, h] = [s.width, s.height]
  // A new size makes a new bitmap: only when the size changes, else the old one is cleared
  const [cw, ch] = [Math.round(w * dpr), Math.round(h * dpr)]
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw
    canvas.height = ch
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cw, ch)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const { ox, oy, scale } = s
  // The sky as the map shows it: az and alt to screen pixels (see SkyView's project)
  const k = (R / 90) * scale
  const [cx, cy] = [ox + C * scale, oy + C * scale]
  const flip = s.below ? -1 : 1
  const pad = 16
  /** Where on screen, written to xy; false if off screen or on the other half of the sky */
  const xy = [0, 0]
  const place = (az: number, alt: number) => {
    if (alt * flip < 0) return false
    const r = (90 - alt * flip) * k
    const a = az * RAD
    const x = cx - flip * r * Math.sin(a)
    const y = cy - r * Math.cos(a)
    if (x < -pad || y < -pad || x > w + pad || y > h + pad) return false
    xy[0] = x
    xy[1] = y
    return true
  }
  // The sky's edge: nothing is drawn past the horizon
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R * scale, 0, Math.PI * 2)
  ctx.clip()

  // ---- The Milky Way: its glow, blurred at a quarter of the size ----
  // Each band (lib/sky.ts milkyWayModel's spine, drawn by SkyView as strokes as wide as the band)
  // is blurred: the broad haze and body as much more as the map is zoomed in, so their edges stay as
  // soft as the band is wide (blurred less, zoomed in they showed as hard edges across the sky); the
  // narrow core and the dark lanes a little less, so they keep some shape; the star clouds' own
  // points are blurred into a mottled light over it; and the dark lanes are cut out of both
  const mw = s.light.milkyWay
  // A small sky (a phone's) packs the star clouds' points closer: each gives less light, so the
  // Milky Way is as bright as on a large one (the drawings were judged at a scale of about 1.7)
  const packed = Math.min(1.2, Math.max(0.55, s.fit / 1.7))
  const work = scratch.get(glow) ?? document.createElement('canvas')
  scratch.set(glow, work)
  for (const el of [glow, work]) {
    if (el.width !== Math.ceil(w / Q) || el.height !== Math.ceil(h / Q)) {
      el.width = Math.ceil(w / Q)
      el.height = Math.ceil(h / Q)
    }
  }
  // Shown exactly four times as large, whatever the rounding
  glow.style.width = `${glow.width * Q}px`
  glow.style.height = `${glow.height * Q}px`
  glow.style.opacity = String(mw)
  const g = glow.getContext('2d')
  g?.clearRect(0, 0, glow.width, glow.height)
  if (mw > 0) {
    const b = work.getContext('2d')
    if (g && b) {
      // A blur of `units` map units at the full view, in pixels of the quarter-size canvases, growing
      // with the zoom as zoom ** grow (1: as the band does)
      const blur = (units: number, grow: number) => (units * s.fit * s.zoom ** grow) / Q
      const strokes = (list: BandStroke[], colour: string) => {
        b.setTransform(1, 0, 0, 1, 0, 0)
        b.clearRect(0, 0, work.width, work.height)
        b.setTransform(scale / Q, 0, 0, scale / Q, ox / Q, oy / Q)
        b.strokeStyle = colour
        for (const st of list) {
          b.globalAlpha = Math.min(1, st.o)
          b.lineWidth = st.w
          b.stroke(new Path2D(st.d))
        }
        b.globalAlpha = 1
      }
      b.lineCap = 'butt'
      strokes(s.band.haze, BAND_COLOUR.haze)
      blurInto(g, work, blur(8, 1), BAND_COLOUR.haze)
      strokes(s.band.body, BAND_COLOUR.body)
      blurInto(g, work, blur(4, 0.9), BAND_COLOUR.body)
      strokes(s.band.core, BAND_COLOUR.core)
      blurInto(g, work, blur(1.4, 0.75), BAND_COLOUR.core)
      // The star clouds as light: their points summed at a quarter of the size, softened a little.
      // Zoomed in they spread apart, and the light they give fades as their points come apart.
      const cloud = s.cloud
      if (cloud) {
        b.setTransform(1, 0, 0, 1, 0, 0)
        b.clearRect(0, 0, work.width, work.height)
        b.globalCompositeOperation = 'lighter'
        const cells = cloud.cells
        if (cells) {
          // At the full view, a cell's points together: its light spread over the cell
          const size = Math.max(1, (CLOUD_CELL * k) / Q)
          for (let i = 0; i < cells.az.length; i++) {
            if (!place(cells.az[i], cells.alt[i])) continue
            b.fillStyle = CLOUD_COLOUR[cells.warm[i]]
            b.globalAlpha = Math.min(1, (cells.light[i] * packed ** 2) / (size * size))
            b.fillRect(xy[0] / Q - size / 2, xy[1] / Q - size / 2, size, size)
          }
        } else {
          const { order, starts } = orderOf(cloud.weight, cloud.warm)
          for (let grp = 0; grp < 2 * LEVELS; grp++) {
            b.fillStyle = CLOUD_COLOUR[grp >= LEVELS ? 1 : 0]
            b.globalAlpha = cloudLight((grp % LEVELS) / LEVELS) * packed ** 2
            for (let n = starts[grp]; n < starts[grp + 1]; n++) {
              const i = order[n]
              if (i < cloud.az.length && place(cloud.az[i], cloud.alt[i])) b.fillRect(xy[0] / Q - 0.5, xy[1] / Q - 0.5, 1, 1)
            }
          }
        }
        b.globalAlpha = 1
        b.globalCompositeOperation = 'source-over'
        g.globalAlpha = Math.min(1, 1.4 / Math.sqrt(s.zoom))
        blurInto(g, work, 0.9 * Math.sqrt(s.zoom), CLOUD_COLOUR[0])
        g.globalAlpha = 1
      }
      // The dark lanes (the Great Rift, the Coalsack), cut out of the glow
      b.setTransform(1, 0, 0, 1, 0, 0)
      b.clearRect(0, 0, work.width, work.height)
      b.setTransform(scale / Q, 0, 0, scale / Q, ox / Q, oy / Q)
      b.lineCap = 'round'
      b.lineJoin = 'round'
      b.strokeStyle = '#000'
      for (const st of s.band.rift) {
        b.globalAlpha = st.o
        b.lineWidth = st.w
        b.stroke(new Path2D(st.d))
      }
      for (const d of s.band.dust) {
        const grad = b.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r)
        grad.addColorStop(0, `rgb(0 0 0 / ${d.a})`)
        grad.addColorStop(0.5, `rgb(0 0 0 / ${d.a * 0.6})`)
        grad.addColorStop(1, 'rgb(0 0 0 / 0)')
        b.globalAlpha = 1
        b.fillStyle = grad
        b.fillRect(d.x - d.r, d.y - d.r, 2 * d.r, 2 * d.r)
      }
      b.globalAlpha = 1
      g.globalCompositeOperation = 'destination-out'
      blurInto(g, work, blur(2.5, 0.75), '#000')
      g.globalCompositeOperation = 'source-over'
    }
  }

  // ---- Points of light: the star clouds' stars, the stars past magnitude 6, the stars to 6 ----
  // At the full view the star clouds' points are hardly more than grain in the glow; zoomed in they
  // are the stars it resolves into, brighter, and the fainter stars all over the sky come out
  ctx.globalCompositeOperation = 'lighter'
  const resolve = Math.min(10, s.zoom ** 1.25)
  const cloud = s.cloud
  if (cloud && mw > 0) {
    const { order, starts } = orderOf(cloud.weight, cloud.warm)
    const step = s.rough ? 3 : 1
    for (let grp = 0; grp < 2 * LEVELS; grp++) {
      const level = grp % LEVELS
      // The faintest only add to the glow, until zoomed in
      if (level === 0 && s.zoom < 2) continue
      ctx.fillStyle = CLOUD_COLOUR[grp >= LEVELS ? 1 : 0]
      // At the full view only the brighter points are drawn singly (the rest are in the cells' light):
      // a little brighter, to stand for the faint ones that fall on the same pixels
      const alone = cloud.cells ? 1.6 : 1
      ctx.globalAlpha = Math.min(1, mw * resolve * alone * packed ** 1.5 * (0.007 + 0.021 * level))
      const size = level === LEVELS - 1 ? 1.4 : 1
      for (let n = starts[grp]; n < starts[grp + 1]; n += step) {
        const i = order[n]
        if (i < cloud.az.length && place(cloud.az[i], cloud.alt[i]))
          ctx.fillRect(Math.round(xy[0]) - size / 2, Math.round(xy[1]) - size / 2, size, size)
      }
    }
  }
  const { stars: strength, limit } = s.light
  const field = s.field
  // Past magnitude 6: out from a zoom of 1.5, and only under a sky dark enough for the faintest
  const fieldShows = strength * Math.min(1, Math.max(0, (s.zoom - 1.5) / 2.5)) * Math.min(1, Math.max(0, limit - 5.3))
  if (field && fieldShows > 0 && !s.rough) {
    for (let level = 0; level < LEVELS; level++) {
      ctx.fillStyle = level % 2 ? FIELD_COLOUR[1] : FIELD_COLOUR[0]
      ctx.globalAlpha = fieldShows * (0.18 + 0.16 * level)
      const size = level === LEVELS - 1 ? 1.4 : 1
      for (let i = 0; i < field.az.length; i++) {
        if (Math.min(LEVELS - 1, Math.floor(field.weight[i] * LEVELS)) !== level) continue
        if (place(field.az[i], field.alt[i]))
          ctx.fillRect(Math.round(xy[0]) - size / 2, Math.round(xy[1]) - size / 2, size, size)
      }
    }
  }
  if (strength > 0) {
    const grow = s.fit * Math.sqrt(s.zoom)
    // In device pixels, each star's picture copied whole to a whole pixel
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const star = (az: number, alt: number, mag: number, bv: number) => {
      // Fainter than can be seen in this light: fading out over the last magnitude
      const seen = Math.min(1, (limit - mag) / 0.8)
      if (seen <= 0 || !place(az, alt)) return
      const px = Math.max(3, Math.round(2 * dpr * Math.max(1.6, glowRadius(mag) * grow))) | 1
      ctx.globalAlpha = strength * seen * starAlpha(mag)
      ctx.drawImage(starSprite(colourIndex(bv), px), Math.round(xy[0] * dpr) - (px >> 1), Math.round(xy[1] * dpr) - (px >> 1))
    }
    const f = s.faint
    if (f)
      for (let i = 0; i < f.az.length; i++) star(f.az[i], f.alt[i], f.rows[i * f.fields + 3], f.rows[i * f.fields + 4])
    for (const st of s.stars) star(st.az, st.alt, st.mag, st.bv)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.restore()
}
