// 穹顶视角: the sky drawn as one stands under it, looking one way (lib/domeProjection): the dome of the
// sky overhead, the horizon an arc with the compass points on it, and the ground a see-through shade,
// so the sky under one's feet shows dimly through it. Dragged to look about and pinched to zoom; or,
// in 对准天空, turned by the phone itself (viewRef, written by the sensors, drawn on the next frame).
// One canvas, redrawn whole each frame the view moves.
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { BRIGHT_STARS, STAR_FIELDS } from '../lib/brightStars'
import { WESTERN } from '../lib/constellations'
import { XINGGUAN } from '../lib/xingguan'
import { cameraFor, dirOf, FOV_MAX, FOV_MIN, groundOf, projectDir, type DomeView, type V3 } from '../lib/domeProjection'
import { cloudLight, directionsAt, STAR_NAMES, vectorsOfStars, type SkyBody } from '../lib/sky'
import type { Constellation } from '../lib/sky'
import { BODY_COLOUR } from './bodyColours'
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
  /** The Milky Way's points (useSkyBackdrop), when loaded */
  cloud: { az: Float32Array; alt: Float32Array; light: Float32Array } | null
  /** The ground: a see-through shade (the sky below shows through it), or none at all */
  ground: boolean
}

interface Props {
  scene: DomeScene
  /** Where one looks; written by a drag here, or by the phone's sensors from outside */
  viewRef: MutableRefObject<DomeView>
  /** Follow a drag and pinch here (off when the phone's sensors turn the view) */
  draggable: boolean
  /** A tap on a body or named star: its key (a body's, or hip + number) */
  onPick?: (key: string) => void
}

/** Turn a list of J2000 lines into horizon directions at a moment and place */
function figureLines(set: Constellation[], utc: Date, lat: number, lon: number) {
  return set.map((c) => ({
    c,
    lines: c.lines.map((line) => {
      const v = new Float64Array(line.length * 1.5)
      for (let i = 0, j = 0; i < line.length; i += 2, j += 3) {
        const ra = line[i] * RAD
        const dec = line[i + 1] * RAD
        v[j] = Math.cos(dec) * Math.cos(ra)
        v[j + 1] = Math.cos(dec) * Math.sin(ra)
        v[j + 2] = Math.sin(dec)
      }
      const { az, alt } = directionsAt(v, utc, lat, lon)
      return Array.from(az, (a, i) => dirOf(a, alt[i]))
    }),
    label: (() => {
      const v = new Float64Array(3)
      const [ra, dec] = [c.label[0] * RAD, c.label[1] * RAD]
      v[0] = Math.cos(dec) * Math.cos(ra)
      v[1] = Math.cos(dec) * Math.sin(ra)
      v[2] = Math.sin(dec)
      const { az, alt } = directionsAt(v, utc, lat, lon)
      return dirOf(az[0], alt[0])
    })(),
  }))
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

export function SkyDome({ scene, viewRef, draggable, onPick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { utc, latitude, longitude } = scene

  // What moves only with the time and place: every star, figure and cloud point as a direction
  const stars = useMemo(() => {
    const { az, alt } = directionsAt(vectorsOfStars(BRIGHT_STARS), utc, latitude, longitude)
    return Array.from(az, (a, i) => ({
      v: dirOf(a, alt[i]),
      hip: BRIGHT_STARS[i * STAR_FIELDS],
      mag: BRIGHT_STARS[i * STAR_FIELDS + 3],
      colour: starColour(BRIGHT_STARS[i * STAR_FIELDS + 4]),
    }))
  }, [utc, latitude, longitude])
  const figures = useMemo(
    () =>
      scene.figures === 'none'
        ? []
        : figureLines(scene.figures === 'west' ? WESTERN : scene.figures === 'mansions' ? XINGGUAN.filter((c) => c.rank === 1) : XINGGUAN, utc, latitude, longitude),
    [scene.figures, utc, latitude, longitude],
  )
  const cloud = useMemo(() => {
    if (!scene.cloud) return null
    const { az, alt, light } = scene.cloud
    return { v: Array.from(az, (a, i) => dirOf(a, alt[i])), light }
  }, [scene.cloud])

  const sceneRef = useRef({ scene, stars, figures, cloud })
  sceneRef.current = { scene, stars, figures, cloud }
  const dirty = useRef(true)
  dirty.current = true

  // Drawn on the next frame whenever anything changed (the view by a drag or the sensors, the scene)
  useEffect(() => {
    let frame = 0
    let last = ''
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const el = canvasRef.current
      if (!el) return
      const v = viewRef.current
      const key = `${v.az.toFixed(2)} ${v.alt.toFixed(2)} ${v.fov.toFixed(2)} ${el.clientWidth} ${el.clientHeight}`
      if (!dirty.current && key === last) return
      dirty.current = false
      last = key
      draw(el, v, sceneRef.current)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
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
      viewRef.current = { ...viewRef.current, fov: Math.min(FOV_MAX, Math.max(FOV_MIN, (g.view.fov * g.dist) / Math.max(1, d))) }
      g.moved = true
      return
    }
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (!g.moved && Math.hypot(dx, dy) < 5) return
    g.moved = true
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
    const at: [number, number] = [0, 0]
    let best: { key: string; d: number } | null = null
    const near = (key: string, v: V3) => {
      if (!projectDir(cam, v, at)) return
      const d = Math.hypot(at[0] - (cx - box.left), at[1] - (cy - box.top))
      if (d < 28 && (!best || d < best.d)) best = { key, d }
    }
    for (const b of sceneRef.current.scene.bodies) near(b.key, dirOf(b.az, b.alt))
    for (const s of sceneRef.current.stars) if (STAR_NAMES[s.hip]) near(`hip${s.hip}`, s.v)
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

type Drawn = { scene: DomeScene; stars: { v: V3; hip: number; mag: number; colour: string }[]; figures: ReturnType<typeof figureLines>; cloud: { v: V3[]; light: Float32Array } | null }

function draw(el: HTMLCanvasElement, view: DomeView, { scene, stars, figures, cloud }: Drawn) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const [w, h] = [el.clientWidth, el.clientHeight]
  if (w < 4 || h < 4) return
  if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
    el.width = Math.round(w * dpr)
    el.height = Math.round(h * dpr)
  }
  const ctx = el.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const cam = cameraFor(view, w, h)
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
  if (cloud && scene.light !== 'day') {
    // Each point adds only a little light (as on the map, cloudLight), so where they crowd the band
    // glows and where they thin it fades, rather than each point standing out as a blot
    const strength = scene.light === 'night' ? 1 : 0.35
    const r = Math.max(1.6, 0.7 * deg)
    ctx.fillStyle = '#9fb0d8'
    for (let i = 0; i < cloud.v.length; i++) {
      if (!projectDir(cam, cloud.v[i], at)) continue
      if (at[0] < -r || at[1] < -r || at[0] > w + r || at[1] > h + r) continue
      ctx.globalAlpha = cloudLight(cloud.light[i]) * 1.4 * strength
      ctx.beginPath()
      ctx.arc(at[0], at[1], r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // ---- Constellation figures ----
  if (figures.length) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = scene.figures === 'west' ? 'rgba(130,160,230,0.42)' : 'rgba(220,170,110,0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    const a: [number, number] = [0, 0]
    const b: [number, number] = [0, 0]
    for (const f of figures)
      for (const line of f.lines)
        for (let i = 1; i < line.length; i++) {
          if (!projectDir(cam, line[i - 1], a) || !projectDir(cam, line[i], b)) continue
          // A segment flung across the screen is one wrapping round behind: left out
          if (Math.hypot(a[0] - b[0], a[1] - b[1]) > Math.max(w, h)) continue
          ctx.moveTo(a[0], a[1])
          ctx.lineTo(b[0], b[1])
        }
    ctx.stroke()
    ctx.globalCompositeOperation = 'lighter'
  }

  // ---- Stars, as bright and as large as their magnitude; the faintest only zoomed in ----
  const limit = Math.min(scene.limit, 4 + 1.5 * Math.log2(Math.max(1, 90 / view.fov)) + 1)
  for (const s of stars) {
    if (s.mag > limit) continue
    if (!projectDir(cam, s.v, at)) continue
    if (at[0] < -10 || at[1] < -10 || at[0] > w + 10 || at[1] > h + 10) continue
    const r = Math.max(0.6, (3.4 - 0.55 * s.mag) * 0.85 * zoom)
    const alpha = Math.min(1, Math.max(0.25, 1.15 - 0.15 * s.mag)) * starsShow
    if (s.mag < 2) {
      const g = ctx.createRadialGradient(at[0], at[1], 0, at[0], at[1], r * 3.2)
      g.addColorStop(0, s.colour)
      g.addColorStop(0.25, s.colour + '88')
      g.addColorStop(1, s.colour + '00')
      ctx.globalAlpha = alpha * 0.7
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(at[0], at[1], r * 3.2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = alpha
    ctx.fillStyle = s.colour
    ctx.beginPath()
    ctx.arc(at[0], at[1], r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

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
      if (f.c.rank > 2 || !projectDir(cam, f.label, at)) continue
      const label = scene.figures === 'west' && scene.en ? f.c.en : f.c.name
      ctx.fillText(label, at[0], at[1])
    }
  }
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(235,238,250,0.8)'
  for (const s of stars) {
    const zh = STAR_NAMES[s.hip]
    if (!zh || s.mag > limit || !projectDir(cam, s.v, at)) continue
    ctx.fillText(scene.name(zh), at[0] + 7, at[1] - 7)
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
