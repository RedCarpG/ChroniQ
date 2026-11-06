// 穹顶视角: the sky drawn as one stands under it, looking one way (lib/domeProjection): the dome of the
// sky overhead, the horizon an arc with the compass points on it, and the ground a see-through shade,
// so the sky under one's feet shows dimly through it. Dragged to look about and pinched to zoom; or,
// in 对准天空, turned by the phone itself (viewRef, written by the sensors, drawn on the next frame).
// One canvas, redrawn whole each frame the view moves, at a lower resolution while it keeps moving.
//
// The stars, figures and Milky Way stay as J2000 directions, worked out once: the moment and place only
// turn the camera (turnCamera), so time running on costs no more than looking about.
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { BRIGHT_STARS, STAR_FIELDS } from '../lib/brightStars'
import { WESTERN } from '../lib/constellations'
import { XINGGUAN } from '../lib/xingguan'
import { cameraFor, dirOf, FOV_MAX, FOV_MIN, groundOf, markPlace, projectDir, projectXYZ, turnCamera, viewShift, type Camera, type DomeView, type V3 } from '../lib/domeProjection'
import { cloudLight, horizonMatrix, milkyWayCloud, STAR_NAMES, vectorsOfStars, type SkyBody } from '../lib/sky'
import type { Constellation } from '../lib/sky'
import { BODY_COLOUR, DSO_COLOUR } from './bodyColours'
import { MESSIER, messierName, type Messier } from '../lib/messier'
import { starColour } from './skyPaint'

const RAD = Math.PI / 180

export interface DomeScene {
  utc: Date
  latitude: number
  longitude: number
  bodies: SkyBody[]
  /** day, twilight or night: how much of the stars and the Milky Way shows */
  light: 'day' | 'twilight' | 'night'
  /** Faintest star drawn */
  limit: number
  figures: 'none' | 'west' | 'china' | 'mansions'
  /** Names in English */
  en: boolean
  /** Name of a body or star in the reader's language */
  name: (zh: string) => string
  /** The ground: a see-through shade (the sky below shows through it), or none at all */
  ground: boolean
  /** The Messier objects (as the map's 深空天体 switch), the equatorial grid and the ecliptic */
  deepSky: boolean
  eqGrid: boolean
  ecliptic: boolean
  /** What is chosen, to be ringed where it is, or pointed to from the screen's edge when out of view */
  mark: { az: number; alt: number; label: string; colour: string } | null
}

interface Props {
  scene: DomeScene
  /** Where one looks; written by a drag here, or by the phone's sensors from outside */
  viewRef: MutableRefObject<DomeView>
  /** Follow a drag and pinch here (off when the phone's sensors turn the view) */
  draggable: boolean
  /** A tap on a body or named star: its key (a body's, or hip + number) */
  onPick?: (key: string) => void
  /** The sky taken in hand: a one-finger drag has begun moving the view (not a pinch) */
  onLook?: () => void
}

// ---- Gliding the view round to something (a search), eased; a drag or another glide stops it ----
const glides = new WeakMap<object, number>()
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Turn the view to look at a direction (and to a field of view), over ms, the short way round */
export function lookAt(viewRef: MutableRefObject<DomeView>, to: { az: number; alt: number; fov?: number }, ms = 650) {
  stopGlide(viewRef)
  const from = { ...viewRef.current }
  const turn = ((to.az - from.az + 540) % 360) - 180
  const fov = to.fov ?? from.fov
  const at = (e: number): DomeView => ({
    az: (((from.az + turn * e) % 360) + 360) % 360,
    alt: from.alt + (to.alt - from.alt) * e,
    fov: from.fov + (fov - from.fov) * e,
  })
  if (ms <= 0 || reducedMotion()) {
    viewRef.current = at(1)
    return
  }
  const start = performance.now()
  const step = (now: number) => {
    const k = Math.min(1, (now - start) / ms)
    viewRef.current = at(k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2)
    if (k < 1) glides.set(viewRef, requestAnimationFrame(step))
    else glides.delete(viewRef)
  }
  glides.set(viewRef, requestAnimationFrame(step))
}
export function stopGlide(viewRef: MutableRefObject<DomeView>) {
  const frame = glides.get(viewRef)
  if (frame !== undefined) cancelAnimationFrame(frame)
  glides.delete(viewRef)
}
export const gliding = (viewRef: MutableRefObject<DomeView>) => glides.has(viewRef)

/** A direction from right ascension and declination (degrees), J2000 */
function unitOf(ra: number, dec: number, out: Float64Array | V3, at = 0) {
  out[at] = Math.cos(dec * RAD) * Math.cos(ra * RAD)
  out[at + 1] = Math.cos(dec * RAD) * Math.sin(ra * RAD)
  out[at + 2] = Math.sin(dec * RAD)
}

/** A set of figures as J2000 directions: each line packed x, y, z after one another, and the label's */
function figureLines(set: Constellation[]) {
  return set.map((c) => ({
    c,
    lines: c.lines.map((line) => {
      const v = new Float64Array(line.length * 1.5)
      for (let i = 0, j = 0; i < line.length; i += 2, j += 3) unitOf(line[i], line[i + 1], v, j)
      return v
    }),
    label: (() => {
      const v: V3 = [0, 0, 0]
      unitOf(c.label[0], c.label[1], v)
      return v
    })(),
  }))
}
type Figures = ReturnType<typeof figureLines>

/** The bright stars as J2000 directions (packed), with what drawing them needs (made once) */
let starList: { v: Float64Array; hip: Int32Array; mag: Float32Array; colour: string[]; named: number[] } | null = null
function brightStars() {
  if (!starList) {
    const count = BRIGHT_STARS.length / STAR_FIELDS
    const hip = Int32Array.from({ length: count }, (_, i) => BRIGHT_STARS[i * STAR_FIELDS])
    starList = {
      v: vectorsOfStars(BRIGHT_STARS),
      hip,
      mag: Float32Array.from({ length: count }, (_, i) => BRIGHT_STARS[i * STAR_FIELDS + 3]),
      colour: Array.from({ length: count }, (_, i) => starColour(BRIGHT_STARS[i * STAR_FIELDS + 4])),
      named: [...hip.keys()].filter((i) => STAR_NAMES[hip[i]]),
    }
  }
  return starList
}
type Stars = ReturnType<typeof brightStars>

/** The Milky Way's brighter points (as the full view of the map draws them), each with its light */
type Cloud = { v: Float64Array; light: Float32Array; count: number }

/** The Messier objects as J2000 directions, each with a point a little along its long axis (made once) */
let messierList: { m: Messier; v: V3; axis: V3 | null }[] | null = null
function messierDirs() {
  if (!messierList)
    messierList = MESSIER.map((m) => {
      const v: V3 = [0, 0, 0]
      unitOf(m.ra, m.dec, v)
      if (m.pa === null) return { m, v, axis: null }
      // The sky's east and north at it, and the long axis between them by its position angle
      const e = Math.hypot(v[0], v[1]) || 1
      const east: V3 = [-v[1] / e, v[0] / e, 0]
      const north: V3 = [v[1] * east[2] - v[2] * east[1], v[2] * east[0] - v[0] * east[2], v[0] * east[1] - v[1] * east[0]]
      const [c, s] = [Math.cos(m.pa * RAD), Math.sin(m.pa * RAD)]
      const d = 0.004
      const axis: V3 = [v[0] + d * (c * north[0] + s * east[0]), v[1] + d * (c * north[1] + s * east[1]), v[2] + d * (c * north[2] + s * east[2])]
      return { m, v, axis }
    })
  return messierList
}
/** How faint a Messier object is still drawn at a field of view: more as one zooms in, as on the map */
const messierLimit = (fov: number) => 5 + 2.2 * (Math.max(1, 120 / fov) - 1)

/** The equatorial grid (declination every 30°, right ascension every 2 hours) and the ecliptic, as
 *  J2000 lines (made once) */
const OBLIQUITY = 23.4393
let gridList: { decs: { dec: number; v: Float64Array }[]; hours: { hour: number; v: Float64Array; label: V3 }[]; ecliptic: Float64Array; signs: V3[] } | null = null
function gridLines() {
  if (!gridList) {
    const line = (points: [number, number][]) => {
      const v = new Float64Array(points.length * 3)
      points.forEach(([ra, dec], i) => unitOf(ra, dec, v, i * 3))
      return v
    }
    const steps = (from: number, to: number, by: number) => Array.from({ length: Math.floor((to - from) / by) + 1 }, (_, i) => from + i * by)
    const e = OBLIQUITY * RAD
    const onEcliptic = (lon: number): [number, number] => {
      const l = lon * RAD
      return [((Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)) / RAD) + 360) % 360, Math.asin(Math.sin(e) * Math.sin(l)) / RAD]
    }
    gridList = {
      decs: [-60, -30, 0, 30, 60].map((dec) => ({ dec, v: line(steps(0, 360, 3).map((ra) => [ra, dec])) })),
      hours: steps(0, 330, 30).map((ra) => {
        const label: V3 = [0, 0, 0]
        unitOf(ra, 0, label)
        return { hour: ra / 15, v: line(steps(-84, 84, 3).map((dec) => [ra, dec])), label }
      }),
      ecliptic: line(steps(0, 360, 3).map(onEcliptic)),
      signs: steps(0, 330, 30).map((lon) => {
        const v: V3 = [0, 0, 0]
        unitOf(...onEcliptic(lon), v)
        return v
      }),
    }
  }
  return gridList
}

/** A packed J2000 line added to the current path, leaving out what is behind or flung across the screen */
function traceLine(ctx: CanvasRenderingContext2D, cam: Camera, line: Float64Array, w: number, h: number) {
  const a: [number, number] = [0, 0]
  const b: [number, number] = [0, 0]
  for (let j = 3; j < line.length; j += 3) {
    if (!projectXYZ(cam, line[j - 3], line[j - 2], line[j - 1], a) || !projectXYZ(cam, line[j], line[j + 1], line[j + 2], b)) continue
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > Math.max(w, h)) continue
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
  }
}

const COMPASS: [string, string, number][] = [
  ['北', 'N', 0],
  ['东北', 'NE', 45],
  ['东', 'E', 90],
  ['东南', 'SE', 135],
  ['南', 'S', 180],
  ['西南', 'SW', 225],
  ['西', 'W', 270],
  ['西北', 'NW', 315],
]

export function SkyDome({ scene, viewRef, draggable, onPick, onLook }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const stars = useMemo(brightStars, [])
  const figures = useMemo(
    () => (scene.figures === 'none' ? [] : figureLines(scene.figures === 'west' ? WESTERN : scene.figures === 'mansions' ? XINGGUAN.filter((c) => c.rank === 1) : XINGGUAN)),
    [scene.figures],
  )
  // The Milky Way is made once for the whole page (sky.milkyWayCloud keeps it); the first time it
  // takes a moment, so it comes after the first frame
  const [cloud, setCloud] = useState<Cloud | null>(null)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const c = milkyWayCloud()
      setCloud({ v: c.v, light: Float32Array.from(c.weight.subarray(0, c.bright), cloudLight), count: c.bright })
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const sceneRef = useRef<Drawn>({ scene, stars, figures, cloud })
  sceneRef.current = { scene, stars, figures, cloud }
  const dirty = useRef(true)
  dirty.current = true

  // Drawn on the next frame whenever anything changed (the view by a drag or the sensors, the scene).
  // A shift of under a quarter pixel (a phone's sensors trembling) is not drawn at all; while the view
  // keeps moving, or the time keeps running, it is drawn at one pixel to the CSS pixel (a quarter of
  // the work on a phone), and sharp again once it has been still for a moment. Its size comes from a
  // ResizeObserver: reading it off the canvas each frame would make the page lay itself out again
  // straight after every change React makes to it
  useEffect(() => {
    let frame = 0
    const el0 = canvasRef.current
    let [width, height] = el0 ? [el0.clientWidth, el0.clientHeight] : [0, 0]
    const watch =
      el0 && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(([entry]) => {
            width = entry.contentRect.width
            height = entry.contentRect.height
          })
        : null
    if (el0) watch?.observe(el0)
    let last: DomeView | null = null
    let size = ''
    let drawnAt = -Infinity
    let rough = false
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const el = canvasRef.current
      if (!el) return
      const v = viewRef.current
      if (!watch) [width, height] = [el.clientWidth, el.clientHeight]
      const box = `${width} ${height}`
      const shift = last && box === size ? viewShift(last, v, Math.min(width, height)) : Infinity
      const settled = now - drawnAt > SETTLE
      if (!dirty.current && shift < 0.25 && !(rough && settled)) return
      // Moving: a real shift since the last frame, or the scene changing again straight after the last
      rough = (shift >= 1 && shift !== Infinity) || (dirty.current && !settled && last !== null)
      dirty.current = false
      last = { ...v }
      size = box
      drawnAt = now
      const sharp = Math.min(2, window.devicePixelRatio || 1)
      draw(el, width, height, v, sceneRef.current, rough ? Math.min(sharp, 1) : sharp, rough)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      watch?.disconnect()
    }
  }, [viewRef])

  // Looking about: one finger (or the mouse) drags the sky along under it, two pinch, the wheel zooms
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ x: number; y: number; view: DomeView; dist?: number; moved: boolean } | null>(null)
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggable) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    gesture.current = {
      x: e.clientX,
      y: e.clientY,
      view: { ...viewRef.current },
      dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined,
      moved: false,
    }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current
    if (!g || !pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const el = canvasRef.current!
    const pts = [...pointers.current.values()]
    if (pts.length === 2 && g.dist) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      stopGlide(viewRef)
      viewRef.current = { ...viewRef.current, fov: Math.min(FOV_MAX, Math.max(FOV_MIN, (g.view.fov * g.dist) / Math.max(1, d))) }
      g.moved = true
      return
    }
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (!g.moved && Math.hypot(dx, dy) < 5) return
    if (!g.moved) {
      // The drag starts from the view as it is now (a glide, or the phone's sensors, may have moved it)
      g.moved = true
      stopGlide(viewRef)
      onLook?.()
      g.view = { ...viewRef.current }
      g.x = e.clientX
      g.y = e.clientY
      return
    }
    // Degrees per pixel at the middle of the view
    const per = g.view.fov / Math.min(el.clientWidth, el.clientHeight)
    viewRef.current = {
      ...viewRef.current,
      az: (((g.view.az - dx * per) % 360) + 360) % 360,
      alt: Math.max(-90, Math.min(90, g.view.alt + dy * per)),
    }
  }
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current
    pointers.current.delete(e.pointerId)
    if (pointers.current.size) {
      // A finger left of two: carry on dragging from the one still down
      const [p] = [...pointers.current.values()]
      gesture.current = { x: p.x, y: p.y, view: { ...viewRef.current }, moved: true }
      return
    }
    gesture.current = null
    if (g && !g.moved && onPick) pick(e.clientX, e.clientY)
  }
  // A tap: the body or named star nearest it on the screen, if close enough
  const pick = (cx: number, cy: number) => {
    const el = canvasRef.current
    if (!el) return
    const box = el.getBoundingClientRect()
    const cam = cameraFor(viewRef.current, box.width, box.height)
    const { scene: sc, stars: st } = sceneRef.current
    const sky = turnCamera(cam, horizonMatrix(sc.utc, sc.latitude, sc.longitude))
    const at: [number, number] = [0, 0]
    let best: { key: string; d: number } | null = null
    const near = (key: string, ok: boolean) => {
      if (!ok) return
      const d = Math.hypot(at[0] - (cx - box.left), at[1] - (cy - box.top))
      if (d < 28 && (!best || d < best.d)) best = { key, d }
    }
    for (const b of sc.bodies) near(b.key, projectDir(cam, dirOf(b.az, b.alt), at))
    for (const i of st.named) near(`hip${st.hip[i]}`, projectXYZ(sky, st.v[i * 3], st.v[i * 3 + 1], st.v[i * 3 + 2], at))
    if (sc.deepSky && sc.light !== 'day')
      for (const d of messierDirs()) if (d.m.mag <= messierLimit(viewRef.current.fov)) near(`dso${d.m.n}`, projectDir(sky, d.v, at))
    if (best) onPick?.((best as { key: string }).key)
  }
  useEffect(() => {
    const el = canvasRef.current
    if (!el || !draggable) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const v = viewRef.current
      viewRef.current = { ...v, fov: Math.min(FOV_MAX, Math.max(FOV_MIN, v.fov * Math.exp(e.deltaY * 0.0012))) }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [draggable, viewRef])

  return (
    <canvas
      ref={canvasRef}
      className={`sky-dome${draggable ? ' draggable' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label={scene.en ? 'The sky as seen standing under it' : '穹顶视角的星空'}
      role="img"
    />
  )
}

type Drawn = { scene: DomeScene; stars: Stars; figures: Figures; cloud: Cloud | null }

/** How long the view must stay still before it is drawn sharp again, ms */
const SETTLE = 160

function draw(el: HTMLCanvasElement, w: number, h: number, view: DomeView, { scene, stars, figures, cloud }: Drawn, dpr: number, rough: boolean) {
  if (w < 4 || h < 4) return
  if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
    el.width = Math.round(w * dpr)
    el.height = Math.round(h * dpr)
  }
  const ctx = el.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const cam = cameraFor(view, w, h)
  // The same camera for J2000 directions (the stars, figures and Milky Way)
  const sky: Camera = turnCamera(cam, horizonMatrix(scene.utc, scene.latitude, scene.longitude))
  const at: [number, number] = [0, 0]
  // How big a degree is in the middle of the view, in pixels: things grow as one zooms in
  const deg = cam.scale * RAD
  const zoom = Math.sqrt(Math.max(0.6, 60 / view.fov))

  // ---- The sky: dark overhead, paler towards the horizon (by day blue, at dusk deep blue) ----
  const tone = scene.light === 'day' ? ['#5a8fd0', '#a9cbea'] : scene.light === 'twilight' ? ['#141d3e', '#3b4a78'] : ['#04060e', '#0d1530']
  const zen: [number, number] = [0, 0]
  const hor: [number, number] = [0, 0]
  const zenOk = projectDir(cam, [0, 0, 1], zen)
  projectDir(cam, dirOf(view.az, 0), hor)
  const grad = zenOk ? ctx.createLinearGradient(zen[0], zen[1], hor[0], hor[1]) : ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, tone[0])
  grad.addColorStop(1, tone[1])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  const starsShow = scene.light === 'day' ? 0.25 : 1
  ctx.globalCompositeOperation = 'lighter'

  // ---- The Milky Way: its points as soft dots, larger as one zooms in ----
  // It is about half the work of a frame, so while the view moves every other point is drawn, twice
  // as bright (as the map thins its own while it moves); all of them once it is still
  if (cloud && scene.light !== 'day') {
    // Each point adds only a little light (as on the map, cloudLight), so where they crowd the band
    // glows and where they thin it fades, rather than each point standing out as a blot
    const step = rough ? 2 : 1
    const strength = (scene.light === 'night' ? 1 : 0.35) * step
    const r = Math.max(1.6, 0.7 * deg)
    ctx.fillStyle = '#9fb0d8'
    for (let i = 0; i < cloud.count; i += step) {
      if (!projectXYZ(sky, cloud.v[i * 3], cloud.v[i * 3 + 1], cloud.v[i * 3 + 2], at)) continue
      if (at[0] < -r || at[1] < -r || at[0] > w + r || at[1] > h + r) continue
      ctx.globalAlpha = cloud.light[i] * 1.4 * strength
      ctx.beginPath()
      ctx.arc(at[0], at[1], r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // ---- The equatorial grid and the ecliptic, under the figures (as on the map) ----
  if (scene.eqGrid || scene.ecliptic) {
    ctx.globalCompositeOperation = 'source-over'
    const grid = gridLines()
    if (scene.eqGrid) {
      ctx.lineWidth = 0.9
      ctx.strokeStyle = 'rgba(110,165,255,0.34)'
      ctx.beginPath()
      for (const d of grid.decs) if (d.dec !== 0) traceLine(ctx, sky, d.v, w, h)
      for (const hr of grid.hours) traceLine(ctx, sky, hr.v, w, h)
      ctx.stroke()
      ctx.lineWidth = 1.3
      ctx.strokeStyle = 'rgba(120,175,255,0.65)'
      ctx.beginPath()
      traceLine(ctx, sky, grid.decs.find((d) => d.dec === 0)!.v, w, h)
      ctx.stroke()
      ctx.font = '10px system-ui, sans-serif'
      ctx.fillStyle = 'rgba(150,190,255,0.8)'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      for (const hr of grid.hours) if (projectDir(sky, hr.label, at)) ctx.fillText(`${hr.hour}h`, at[0] + 3, at[1] - 6)
    }
    if (scene.ecliptic) {
      ctx.lineWidth = 1.4
      ctx.strokeStyle = 'rgba(255,190,90,0.75)'
      ctx.setLineDash([10, 4])
      ctx.beginPath()
      traceLine(ctx, sky, grid.ecliptic, w, h)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(255,190,90,0.9)'
      for (const v of grid.signs) {
        if (!projectDir(sky, v, at)) continue
        ctx.beginPath()
        ctx.arc(at[0], at[1], 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalCompositeOperation = 'lighter'
  }

  // ---- Constellation figures ----
  if (figures.length) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = scene.figures === 'west' ? 'rgba(130,160,230,0.42)' : 'rgba(220,170,110,0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const f of figures) for (const line of f.lines) traceLine(ctx, sky, line, w, h)
    ctx.stroke()
    ctx.globalCompositeOperation = 'lighter'
  }

  // ---- Stars, as bright and as large as their magnitude; the faintest only zoomed in ----
  const limit = Math.min(scene.limit, 4 + 1.5 * Math.log2(Math.max(1, 90 / view.fov)) + 1)
  for (let i = 0; i < stars.mag.length; i++) {
    const mag = stars.mag[i]
    if (mag > limit) continue
    if (!projectXYZ(sky, stars.v[i * 3], stars.v[i * 3 + 1], stars.v[i * 3 + 2], at)) continue
    if (at[0] < -10 || at[1] < -10 || at[0] > w + 10 || at[1] > h + 10) continue
    const colour = stars.colour[i]
    const r = Math.max(0.6, (3.4 - 0.55 * mag) * 0.85 * zoom)
    const alpha = Math.min(1, Math.max(0.25, 1.15 - 0.15 * mag)) * starsShow
    if (mag < 2) {
      const g = ctx.createRadialGradient(at[0], at[1], 0, at[0], at[1], r * 3.2)
      g.addColorStop(0, colour)
      g.addColorStop(0.25, colour + '88')
      g.addColorStop(1, colour + '00')
      ctx.globalAlpha = alpha * 0.7
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(at[0], at[1], r * 3.2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = alpha
    ctx.fillStyle = colour
    ctx.beginPath()
    ctx.arc(at[0], at[1], r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // ---- The Messier objects, marked as on the map: by kind, at their true size, galaxies turned ----
  const dsos = scene.deepSky && scene.light !== 'day' ? messierDirs().filter((d) => d.m.mag <= messierLimit(view.fov)) : []
  if (dsos.length) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.lineWidth = 1.1
    for (const { m, v, axis } of dsos) {
      if (!projectDir(sky, v, at)) continue
      const r = Math.max(4, (m.size[0] / 60 / 2) * deg)
      if (at[0] < -r || at[1] < -r || at[0] > w + r || at[1] > h + r) continue
      const colour = DSO_COLOUR[m.kind]
      let turn = 0
      if (axis) {
        const b: [number, number] = [0, 0]
        if (projectDir(sky, axis, b)) turn = Math.atan2(b[1] - at[1], b[0] - at[0])
      }
      drawMessier(ctx, m, at[0], at[1], r, turn, colour)
    }
    ctx.globalCompositeOperation = 'lighter'
  }

  // ---- The Sun, the Moon (lit towards the Sun) and the planets ----
  const sun = scene.bodies.find((b) => b.key === 'sun')
  for (const b of [...scene.bodies].sort((x, y) => (x.key === 'moon' ? 1 : y.key === 'moon' ? -1 : 0))) {
    const v = dirOf(b.az, b.alt)
    if (!projectDir(cam, v, at)) continue
    const colour = BODY_COLOUR[b.key] ?? '#ffffff'
    if (b.key === 'sun' || b.key === 'moon') {
      // As large as they are (about half a degree), but never too small to see
      const r = Math.max(b.key === 'sun' ? 7 : 6, 0.26 * deg)
      const halo = ctx.createRadialGradient(at[0], at[1], r * 0.6, at[0], at[1], r * 4)
      halo.addColorStop(0, b.key === 'sun' ? 'rgba(255,240,200,0.55)' : 'rgba(220,230,255,0.28)')
      halo.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(at[0], at[1], r * 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      if (b.key === 'moon' && sun) drawMoon(ctx, cam, at, r, b, sun)
      else {
        ctx.fillStyle = '#fff4d6'
        ctx.beginPath()
        ctx.arc(at[0], at[1], r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'lighter'
    } else {
      const r = Math.max(1.6, (3 - 0.4 * b.mag) * zoom)
      const g = ctx.createRadialGradient(at[0], at[1], 0, at[0], at[1], r * 3)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(0.3, colour)
      g.addColorStop(1, colour + '00')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(at[0], at[1], r * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalCompositeOperation = 'source-over'

  // ---- Names: the bodies, the named stars, the best-known figures ----
  ctx.textBaseline = 'middle'
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(170,185,230,0.75)'
  if (figures.length) {
    ctx.textAlign = 'center'
    for (const f of figures) {
      if (f.c.rank > 2 || !projectDir(sky, f.label, at)) continue
      const label = scene.figures === 'west' && scene.en ? f.c.en : f.c.name
      ctx.fillText(label, at[0], at[1])
    }
  }
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(235,238,250,0.8)'
  for (const i of stars.named) {
    const zh = STAR_NAMES[stars.hip[i]]
    if (stars.mag[i] > limit || !projectXYZ(sky, stars.v[i * 3], stars.v[i * 3 + 1], stars.v[i * 3 + 2], at)) continue
    ctx.fillText(scene.name(zh), at[0] + 7, at[1] - 7)
  }
  // The Messier objects' numbers (with their names zoomed in), the brighter first, none over another
  if (dsos.length) {
    ctx.font = '11px system-ui, sans-serif'
    const placed: [number, number][] = []
    for (const { m, v } of [...dsos].sort((a, b) => a.m.mag - b.m.mag)) {
      if (!(view.fov <= 67 || m.mag <= 4.6) || !projectDir(sky, v, at)) continue
      if (placed.some(([x, y]) => Math.abs(x - at[0]) < 44 && Math.abs(y - at[1]) < 12)) continue
      placed.push([at[0], at[1]])
      const name = view.fov <= 45 && (scene.en ? m.en : m.zh)
      ctx.fillStyle = DSO_COLOUR[m.kind]
      ctx.globalAlpha = 0.85
      ctx.fillText(name ? `M${m.n} ${messierName(m, scene.en)}` : `M${m.n}`, at[0] + Math.max(4, (m.size[0] / 60 / 2) * deg) + 4, at[1])
    }
    ctx.globalAlpha = 1
  }
  ctx.font = '600 13px system-ui, sans-serif'
  for (const b of scene.bodies) {
    if (!projectDir(cam, dirOf(b.az, b.alt), at)) continue
    ctx.fillStyle = BODY_COLOUR[b.key] ?? '#fff'
    const off = b.key === 'sun' || b.key === 'moon' ? Math.max(10, 0.3 * deg) : 9
    ctx.fillText(scene.name(b.name), at[0] + off, at[1] - off)
  }

  // ---- The ground: a see-through shade over the sky below, so it shows dimly through ----
  if (scene.ground) {
    const g = groundOf(cam, view)
    ctx.beginPath()
    if (g.kind === 'line') ctx.rect(-10, g.y, w + 20, h - g.y + 10)
    else if (g.inside) ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2)
    else {
      ctx.rect(-10, -10, w + 20, h + 20)
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2, true)
    }
    ctx.fillStyle = scene.light === 'day' ? 'rgba(46,58,40,0.72)' : 'rgba(8,12,10,0.62)'
    ctx.fill('evenodd')
  }

  // ---- The horizon, with the compass round it ----
  ctx.strokeStyle = 'rgba(220,190,130,0.75)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  let pen = false
  const prev: [number, number] = [0, 0]
  for (let az = 0; az <= 360; az += 2) {
    if (!projectDir(cam, dirOf(az, 0), at)) {
      pen = false
      continue
    }
    if (pen && Math.hypot(at[0] - prev[0], at[1] - prev[1]) < Math.max(w, h)) ctx.lineTo(at[0], at[1])
    else ctx.moveTo(at[0], at[1])
    pen = true
    prev[0] = at[0]
    prev[1] = at[1]
  }
  ctx.stroke()
  ctx.textAlign = 'center'
  for (const [zh, en, az] of COMPASS) {
    if (!projectDir(cam, dirOf(az, 0), at)) continue
    const major = az % 90 === 0
    ctx.font = major ? '600 16px system-ui, sans-serif' : '12px system-ui, sans-serif'
    ctx.fillStyle = major ? 'rgba(235,205,140,0.95)' : 'rgba(220,195,150,0.7)'
    ctx.fillText(scene.en ? en : zh, at[0], at[1] + (major ? 14 : 12))
  }
  // Where the middle of the view is: a faint cross
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.beginPath()
  ctx.moveTo(cam.cx - 8, cam.cy)
  ctx.lineTo(cam.cx + 8, cam.cy)
  ctx.moveTo(cam.cx, cam.cy - 8)
  ctx.lineTo(cam.cx, cam.cy + 8)
  ctx.stroke()

  if (scene.mark) drawMark(ctx, cam, scene.mark, w, h)
}

/** A Messier object's mark, as the map draws it: a galaxy an ellipse along its long axis, a globular
 *  cluster a crossed circle, an open cluster a dashed one, a planetary nebula a small circle with
 *  ticks, other nebulae a rounded square; galaxies and nebulae on a faint glow */
function drawMessier(ctx: CanvasRenderingContext2D, m: Messier, x: number, y: number, r: number, turn: number, colour: string) {
  const flat = Math.max(0.45, m.size[1] / m.size[0])
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = colour
  ctx.fillStyle = colour
  if (m.kind !== 'oc' && m.kind !== 'asterism') {
    ctx.save()
    ctx.rotate(turn)
    ctx.scale(1, flat)
    ctx.globalAlpha = Math.min(0.22, Math.max(0.06, (11 - m.mag) / 40))
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  switch (m.kind) {
    case 'galaxy':
      ctx.rotate(turn)
      ctx.ellipse(0, 0, r, r * flat, 0, 0, Math.PI * 2)
      break
    case 'gc':
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.moveTo(-r, 0)
      ctx.lineTo(r, 0)
      ctx.moveTo(0, -r)
      ctx.lineTo(0, r)
      break
    case 'oc':
    case 'asterism':
      ctx.setLineDash([3, 2.5])
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      break
    case 'pn':
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ctx.moveTo(dx * r, dy * r)
        ctx.lineTo(dx * r * 0.6, dy * r * 0.6)
      }
      break
    default:
      if (ctx.roundRect) ctx.roundRect(-r, -r, 2 * r, 2 * r, r * 0.2)
      else ctx.rect(-r, -r, 2 * r, 2 * r)
  }
  ctx.stroke()
  ctx.restore()
}

/** The chosen one: a ring round it with its name, or an arrow at the edge pointing the way to it */
function drawMark(ctx: CanvasRenderingContext2D, cam: Camera, mark: NonNullable<DomeScene['mark']>, w: number, h: number) {
  const m = markPlace(cam, dirOf(mark.az, mark.alt), w, h)
  ctx.save()
  ctx.globalAlpha = 1
  ctx.lineWidth = 1.6
  ctx.strokeStyle = 'rgba(244,206,128,0.95)'
  ctx.fillStyle = 'rgba(244,206,128,0.95)'
  ctx.font = '600 13px system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  if (m.inView) {
    ctx.beginPath()
    ctx.arc(m.x, m.y, 15, 0, Math.PI * 2)
    ctx.stroke()
    // Four short ticks, as a sight
    for (const a of [0, 0.5, 1, 1.5]) {
      const [c, s] = [Math.cos(a * Math.PI), Math.sin(a * Math.PI)]
      ctx.beginPath()
      ctx.moveTo(m.x + c * 15, m.y + s * 15)
      ctx.lineTo(m.x + c * 21, m.y + s * 21)
      ctx.stroke()
    }
  } else {
    // An arrowhead pointing out towards it, its name on the inner side
    ctx.save()
    ctx.translate(m.x, m.y)
    ctx.rotate(m.angle)
    ctx.beginPath()
    ctx.moveTo(14, 0)
    ctx.lineTo(-6, -9)
    ctx.lineTo(-2, 0)
    ctx.lineTo(-6, 9)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  // The name: beside the ring, or inside the arrow, kept on the screen
  const text = mark.label
  const width = ctx.measureText(text).width
  // Above the ring (a star's or body's own name sits to its right), or inside the arrow
  let [tx, ty] = m.inView ? [m.x, m.y - 32] : [m.x - Math.cos(m.angle) * 26, m.y - Math.sin(m.angle) * 22]
  ctx.textAlign = 'left'
  tx -= width / 2
  tx = Math.max(6, Math.min(w - 6 - width, tx))
  ty = Math.max(10, Math.min(h - 10, ty))
  ctx.shadowColor = 'rgba(0,0,0,0.8)'
  ctx.shadowBlur = 4
  ctx.fillText(text, tx, ty)
  ctx.restore()
}

/** The Moon's disc, lit on the side towards the Sun as much as it is */
function drawMoon(ctx: CanvasRenderingContext2D, cam: ReturnType<typeof cameraFor>, at: [number, number], r: number, moon: SkyBody, sun: SkyBody) {
  const s: [number, number] = [0, 0]
  // Which way the Sun lies on the screen from the Moon: a step from the Moon towards it
  const mv = dirOf(moon.az, moon.alt)
  const sv = dirOf(sun.az, sun.alt)
  const step: V3 = [mv[0] + (sv[0] - mv[0]) * 0.02, mv[1] + (sv[1] - mv[1]) * 0.02, mv[2] + (sv[2] - mv[2]) * 0.02]
  const len = Math.hypot(...step)
  projectDir(cam, [step[0] / len, step[1] / len, step[2] / len], s)
  const turn = Math.atan2(s[1] - at[1], s[0] - at[0])
  ctx.save()
  ctx.translate(at[0], at[1])
  ctx.rotate(turn)
  // The dark disc, then the lit part: a half towards the Sun, and the terminator's ellipse
  ctx.fillStyle = '#2a2e3a'
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  const k = 1 - 2 * moon.lit
  ctx.fillStyle = '#f2efe4'
  ctx.beginPath()
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2)
  ctx.ellipse(0, 0, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k > 0)
  ctx.fill()
  ctx.restore()
}
