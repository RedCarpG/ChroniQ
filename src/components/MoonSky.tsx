// 观月's backdrop: the sky about the Moon as one would see it from the place, over the whole screen.
// The Moon is looked at straight on (the view turned to it, the horizon kept level, as in the 天象
// page's dome view: lib/domeProjection), drawn by MoonGlobe at its true size for the field of view;
// round it, dark space (at any hour: no daylight blue), the stars and planets that are there, and the
// ground with the horizon when it comes into view. Zoomed in, the Moon is larger than the screen, as
// in a telescope; zoomed out, it is the small bright disc one sees with the eye, among the stars.
//
// A drag across moves the time; the wheel, a pinch or the buttons zoom.
import { useEffect, useMemo, useRef, useState } from 'react'
import { BRIGHT_STARS, STAR_FIELDS } from '../lib/brightStars'
import { cameraFor, dirOf, groundOf, projectDir, projectXYZ, turnCamera, type Camera, type DomeView } from '../lib/domeProjection'
import type { MoonView } from '../lib/moonView'
import { horizonMatrix, skyAt, vectorsOfStars } from '../lib/sky'
import { BODY_COLOUR } from './bodyColours'
import type { Frame } from './Immersive'
import { MoonGlobe } from './MoonGlobe'

const RAD = Math.PI / 180

/** Widest field of view, degrees */
export const MOON_FOV_MAX = 100
/** Narrowest: the Moon three times as wide as the screen's shorter side (a close look at its craters;
 *  past that its map, 2048 pixels round, would only blur) */
export const moonFovMin = (diameter: number) => fovFor(diameter, 3)
/** The field of view in which a disc `diameter` degrees across fills `share` of the shorter side */
export function fovFor(diameter: number, share: number) {
  return (4 * Math.atan(Math.tan((diameter * RAD) / 4) / share)) / RAD
}

/** Seas and craters on the near side to name: selenographic latitude and longitude (east +), degrees */
const FEATURES: { zh: string; en: string; lat: number; lon: number; sea: boolean }[] = [
  { zh: '静海', en: 'Mare Tranquillitatis', lat: 8.5, lon: 31.4, sea: true },
  { zh: '澄海', en: 'Mare Serenitatis', lat: 28, lon: 17.5, sea: true },
  { zh: '危海', en: 'Mare Crisium', lat: 17, lon: 59.1, sea: true },
  { zh: '丰富海', en: 'Mare Fecunditatis', lat: -7.8, lon: 51.3, sea: true },
  { zh: '酒海', en: 'Mare Nectaris', lat: -15.2, lon: 35.5, sea: true },
  { zh: '雨海', en: 'Mare Imbrium', lat: 32.8, lon: -15.6, sea: true },
  { zh: '风暴洋', en: 'Oceanus Procellarum', lat: 18.4, lon: -57.4, sea: true },
  { zh: '云海', en: 'Mare Nubium', lat: -21.3, lon: -16.6, sea: true },
  { zh: '湿海', en: 'Mare Humorum', lat: -24.4, lon: -38.6, sea: true },
  { zh: '冷海', en: 'Mare Frigoris', lat: 56, lon: 1.4, sea: true },
  { zh: '第谷', en: 'Tycho', lat: -43.3, lon: -11.4, sea: false },
  { zh: '哥白尼', en: 'Copernicus', lat: 9.6, lon: -20.1, sea: false },
  { zh: '开普勒', en: 'Kepler', lat: 8.1, lon: -38, sea: false },
  { zh: '阿里斯塔克', en: 'Aristarchus', lat: 23.7, lon: -47.4, sea: false },
  { zh: '柏拉图', en: 'Plato', lat: 51.6, lon: -9.4, sea: false },
]

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

/** A star's colour from its B−V index */
const starTint = (bv: number) =>
  bv < 0 ? '#b8ccff' : bv < 0.3 ? '#e2e9ff' : bv < 0.6 ? '#fff8ec' : bv < 1 ? '#ffeccc' : bv < 1.4 ? '#ffd8ae' : '#ffc394'

interface Props {
  utc: Date
  latitude: number
  longitude: number
  moon: MoonView
  frame: Frame
  fov: number
  onFov: (fov: number) => void
  /** A drag across the sky moves the time by this much (ms) */
  onScrub: (deltaMs: number) => void
  /** Name the seas and craters */
  features: boolean
  en: boolean
  /** A body's name in the reader's language */
  name: (zh: string) => string
  globeLabel: string
}

export function MoonSky({ utc, latitude, longitude, moon, frame, fov, onFov, onScrub, features, en, name, globeLabel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [screen, setScreen] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const on = () => setScreen({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  // The fainter stars (to magnitude 6) come after the first frame
  const [faint, setFaint] = useState<readonly number[] | null>(null)
  useEffect(() => {
    let gone = false
    import('../lib/faintStars')
      .then(({ FAINT_STARS }) => !gone && setFaint(FAINT_STARS))
      .catch(() => {
        // offline before they were kept: the bright stars do
      })
    return () => {
      gone = true
    }
  }, [])

  const bodies = useMemo(() => skyAt(utc, latitude, longitude, false, false).bodies, [utc, latitude, longitude])
  // Always looking straight at the Moon, in the middle of the room left free (below the horizon too:
  // the ground and horizon come into view when the field is wide enough)
  const view: DomeView = { az: moon.az, alt: moon.alt, fov }
  const cam = useMemo(() => {
    const c = cameraFor(view, Math.max(1, frame.width), Math.max(1, frame.height))
    return { ...c, cx: frame.left + frame.width / 2, cy: frame.top + frame.height / 2 }
    // view is made from these
  }, [moon.az, view.alt, fov, frame])
  const at: [number, number] = [0, 0]
  projectDir(cam, dirOf(moon.az, moon.alt), at)
  const moonX = at[0]
  const moonY = at[1]
  /** Pixels across a disc of this many degrees at the middle of the view */
  const across = (deg: number) => 2 * cam.scale * 2 * Math.tan((deg * RAD) / 4)
  const moonPx = across(moon.diameter)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const { w, h } = screen
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // In a lunar eclipse the Moon's light in the sky fades with it (to about a tenth when wholly in the umbra)
    const sh = moon.frame.shadow
    const shade = Math.min(1, Math.max(0.12, (Math.hypot(sh.x, sh.y) - sh.umbra + 1) / 2))
    drawSky(ctx, w, h, cam, view, { utc, latitude, longitude, lit: moon.lit * shade, moonX, moonY, moonPx, bodies, faint, en, name })
  })

  // A drag across moves the time (about five minutes a pixel zoomed in, more zoomed out); two fingers
  // pinch. Once a second finger has come down, the gesture only zooms until every finger is lifted; a
  // touch only starts moving the time after a little way or a moment, so a pinch never begins as a drag
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ x: number; dist?: number; fov: number; pinched: boolean; dragging: boolean; at: number } | null>(null)
  const perPx = 5 * 60_000 * Math.max(1, Math.sqrt(fov / 2))
  const clampFov = (f: number) => Math.max(moonFovMin(moon.diameter), Math.min(MOON_FOV_MAX, f))
  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId)
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const pts = [...pointers.current.values()]
      if (pts.length === 1) gesture.current = { x: e.clientX, fov, pinched: false, dragging: false, at: e.timeStamp }
      else if (pts.length === 2) gesture.current = { x: e.clientX, fov, dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), pinched: true, dragging: false, at: e.timeStamp }
    },
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => {
      const g = gesture.current
      if (!pointers.current.has(e.pointerId) || !g) return
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const pts = [...pointers.current.values()]
      if (g.pinched) {
        if (pts.length === 2 && g.dist) onFov(clampFov((g.fov * g.dist) / Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y))))
        return
      }
      const dx = e.clientX - g.x
      if (!g.dragging) {
        const touch = e.pointerType === 'touch'
        if (Math.abs(dx) < (touch ? 10 : 3) || (touch && e.timeStamp - g.at < 120)) return
        g.dragging = true
      }
      if (Math.abs(dx) >= 1) {
        g.x = e.clientX
        onScrub(Math.round((dx * perPx) / 60_000) * 60_000)
      }
    },
    onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => {
      pointers.current.delete(e.pointerId)
      if (pointers.current.size === 0) gesture.current = null
    },
    onWheel: (e: React.WheelEvent<HTMLCanvasElement>) => onFov(clampFov(fov * Math.exp(e.deltaY * 0.0015))),
  }

  // The seas and craters, where they are on the disc as it is turned
  const named =
    features && moonPx >= 200
      ? FEATURES.flatMap((f) => {
          const [X, Y, Z] = moon.frame.body
          const c = Math.cos(f.lat * RAD)
          const b = [c * Math.cos(f.lon * RAD), c * Math.sin(f.lon * RAD), Math.sin(f.lat * RAD)]
          const n = [0, 1, 2].map((i) => b[0] * X[i] + b[1] * Y[i] + b[2] * Z[i])
          if (n[2] < 0.2 || (!f.sea && moonPx < 420)) return []
          const x = moonX + (n[0] * moonPx) / 2
          const y = moonY - (n[1] * moonPx) / 2
          if (x < 0 || y < 0 || x > screen.w || y > screen.h) return []
          return [{ ...f, x, y }]
        })
      : []

  // The globe's element: the disc's square, or, once the disc is larger than the screen, only the part
  // of it on the screen (MoonGlobe draws just that), so the canvas never grows past the screen
  const R = moonPx / 2
  const box = {
    left: Math.max(-2, moonX - R * 1.02),
    top: Math.max(-2, moonY - R * 1.02),
    right: Math.min(screen.w + 2, moonX + R * 1.02),
    bottom: Math.min(screen.h + 2, moonY + R * 1.02),
  }
  const onScreen = box.right > box.left && box.bottom > box.top
  return (
    <div className="moon-sky">
      <canvas
        ref={canvasRef}
        className="moon-sky-canvas"
        style={{ width: screen.w, height: screen.h }}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerUp}
        onWheel={handlers.onWheel}
      />
      {onScreen && (
        <div
          className="moon-sky-globe"
          style={{ left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top }}
        >
          <MoonGlobe frame={moon.frame} lit={moon.lit} label={globeLabel} crop={{ cx: moonX - box.left, cy: moonY - box.top, r: R }} />
        </div>
      )}
      {named.map((f) => (
        <span key={f.zh} className={`moon-feature${f.sea ? ' sea' : ''}`} style={{ left: f.x, top: f.y }}>
          {en ? f.en : f.zh}
        </span>
      ))}
    </div>
  )
}

interface Scene {
  utc: Date
  latitude: number
  longitude: number
  lit: number
  moonX: number
  moonY: number
  moonPx: number
  bodies: ReturnType<typeof skyAt>['bodies']
  faint: readonly number[] | null
  en: boolean
  name: (zh: string) => string
}

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera, view: DomeView, s: Scene) {
  // ---- Space behind it all, the same at any hour (no daylight blue): a little lighter about the Moon ----
  const space = ctx.createRadialGradient(s.moonX, s.moonY, 0, s.moonX, s.moonY, Math.max(w, h) * 0.9)
  space.addColorStop(0, '#121a32')
  space.addColorStop(0.5, '#0a0f20')
  space.addColorStop(1, '#04060d')
  ctx.fillStyle = space
  ctx.fillRect(0, 0, w, h)

  // ---- The Moon's light in the sky: a soft halo about the disc, and the sky brightened for some
  // degrees round it (a whole telescope view lies inside that, faintly lit) ----
  const night = 1
  const wide = 2 * cam.scale * 2 * Math.tan((8 * RAD) / 4)
  const sky = ctx.createRadialGradient(s.moonX, s.moonY, 0, s.moonX, s.moonY, Math.max(wide, s.moonPx))
  const a2 = 0.05 * s.lit * night
  sky.addColorStop(0, `rgba(210,220,250,${a2})`)
  sky.addColorStop(1, 'rgba(210,220,250,0)')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  if (s.moonPx > 3) {
    const halo = ctx.createRadialGradient(s.moonX, s.moonY, s.moonPx * 0.48, s.moonX, s.moonY, s.moonPx * 1.25)
    const a1 = (0.04 + 0.13 * s.lit) * night
    halo.addColorStop(0, `rgba(232,236,255,${a1})`)
    halo.addColorStop(1, 'rgba(232,236,255,0)')
    ctx.fillStyle = halo
    ctx.fillRect(s.moonX - s.moonPx * 1.3, s.moonY - s.moonPx * 1.3, s.moonPx * 2.6, s.moonPx * 2.6)
  } else {
    // The eye's view: a small bright point with a glow round it
    const dot = ctx.createRadialGradient(s.moonX, s.moonY, 0, s.moonX, s.moonY, 18)
    dot.addColorStop(0, `rgba(240,240,255,${0.5 * night + 0.2})`)
    dot.addColorStop(1, 'rgba(240,240,255,0)')
    ctx.fillStyle = dot
    ctx.fillRect(s.moonX - 18, s.moonY - 18, 36, 36)
  }
  if (s.moonPx < 24) {
    ctx.font = '600 13px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(240,232,210,0.9)'
    ctx.fillText(s.name('月亮'), s.moonX + Math.max(8, s.moonPx), s.moonY - Math.max(8, s.moonPx))
  }

  // ---- The stars, as J2000 directions with the camera turned to them ----
  const turned = turnCamera(cam, horizonMatrix(s.utc, s.latitude, s.longitude))
  // All the stars to magnitude 6, as from space; only close to the Moon are they lost in its light
  const limit = 6
  const p: [number, number] = [0, 0]
  const reach = Math.cos(Math.min(170, view.fov * 1.2) * RAD)
  const drawStars = (rows: readonly number[]) => {
    const v = vectorsOfStars(rows)
    for (let i = 0, j = 0; i < rows.length; i += STAR_FIELDS, j += 3) {
      const mag = rows[i + 3]
      if (mag > limit) continue
      const x = v[j]
      const y = v[j + 1]
      const z = v[j + 2]
      if (x * turned.f[0] + y * turned.f[1] + z * turned.f[2] < reach) continue
      if (!projectXYZ(turned, x, y, z, p) || p[0] < -4 || p[1] < -4 || p[0] > w + 4 || p[1] > h + 4) continue
      // Lost in the Moon's glare close to it
      const dm = Math.hypot(p[0] - s.moonX, p[1] - s.moonY) / Math.max(1, s.moonPx)
      const glare = s.lit > 0.05 ? Math.min(1, Math.max(0.05, (dm - 0.6) / 4)) : 1
      const r = Math.min(3, Math.max(0.55, (limit - mag + 1) * 0.42))
      ctx.globalAlpha = Math.min(1, Math.max(0.18, (limit - mag + 0.6) / 2.4)) * glare
      ctx.fillStyle = starTint(rows[i + 4])
      ctx.beginPath()
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  drawStars(BRIGHT_STARS)
  if (s.faint) drawStars(s.faint)
  ctx.globalAlpha = 1

  // ---- The Sun and the planets (not the Moon, drawn by MoonGlobe) ----
  const deg = cam.scale * 2 * Math.tan(RAD / 4) * 2
  ctx.font = '600 12px system-ui, sans-serif'
  ctx.textAlign = 'left'
  for (const b of s.bodies) {
    if (b.key === 'moon') continue
    if (!projectDir(cam, dirOf(b.az, b.alt), p) || p[0] < -40 || p[1] < -40 || p[0] > w + 40 || p[1] > h + 40) continue
    const colour = BODY_COLOUR[b.key] ?? '#fff'
    if (b.key === 'sun') {
      const r = Math.max(6, (0.53 * deg) / 2)
      const sg = ctx.createRadialGradient(p[0], p[1], r * 0.6, p[0], p[1], r * 6)
      sg.addColorStop(0, 'rgba(255,240,200,0.9)')
      sg.addColorStop(1, 'rgba(255,220,150,0)')
      ctx.fillStyle = sg
      ctx.fillRect(p[0] - r * 6, p[1] - r * 6, r * 12, r * 12)
      ctx.fillStyle = '#fff6dc'
      ctx.beginPath()
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    if (b.mag > limit + 1.5) continue
    ctx.fillStyle = colour
    ctx.globalAlpha = 0.95
    ctx.beginPath()
    ctx.arc(p[0], p[1], Math.min(4, Math.max(1.4, 2.6 - 0.35 * b.mag)), 0, Math.PI * 2)
    ctx.fill()
    if (view.fov > 6) {
      ctx.globalAlpha = 0.85
      ctx.fillText(s.name(b.name), p[0] + 7, p[1] - 6)
    }
    ctx.globalAlpha = 1
  }

  // ---- The ground, and the horizon with the compass on it ----
  const g = groundOf(cam, view)
  ctx.beginPath()
  if (g.kind === 'line') ctx.rect(-10, g.y, w + 20, h - g.y + 10)
  else if (g.inside) ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2)
  else {
    ctx.rect(-10, -10, w + 20, h + 20)
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2, true)
  }
  const ground = ctx.createLinearGradient(0, 0, 0, h)
  // A see-through shade, as on the 天象 page's dome: the sky below still shows dimly through it
  ground.addColorStop(0, 'rgba(6,9,10,0.6)')
  ground.addColorStop(1, 'rgba(3,5,7,0.72)')
  ctx.fillStyle = ground
  ctx.fill('evenodd')
  ctx.strokeStyle = 'rgba(220,190,130,0.6)'
  ctx.lineWidth = 1
  ctx.beginPath()
  let pen = false
  for (let az = 0; az <= 360; az += 1) {
    if (!projectDir(cam, dirOf(az, 0), p) || p[0] < -w || p[0] > 2 * w || p[1] < -h || p[1] > 2 * h) {
      pen = false
      continue
    }
    if (pen) ctx.lineTo(p[0], p[1])
    else ctx.moveTo(p[0], p[1])
    pen = true
  }
  ctx.stroke()
  ctx.textAlign = 'center'
  for (const [zh, en, az] of COMPASS) {
    if (!projectDir(cam, dirOf(az, 0), p) || p[0] < 0 || p[0] > w || p[1] < 0 || p[1] > h) continue
    const major = az % 90 === 0
    ctx.font = major ? '600 15px system-ui, sans-serif' : '12px system-ui, sans-serif'
    ctx.fillStyle = major ? 'rgba(235,205,140,0.95)' : 'rgba(220,195,150,0.7)'
    ctx.fillText(s.en ? en : zh, p[0], p[1] + (major ? 18 : 15))
  }
}
