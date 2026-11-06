import { BODY_COLOUR, DSO_COLOUR } from './bodyColours'
import { project, projectSky, pathData, placeLabels } from './skyGeometry'
import { SKYLINE, GROUND, TICKS, SKY_STOPS, HORIZON_GLOW } from './skyDecorations'
import { useSkyBackdrop } from './useSkyBackdrop'
import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { toUtc, type StarPlace } from '../lib/astrology'
import { WESTERN } from '../lib/constellations'
import {
  PATH_BODIES,
  constellationsAt,
  distanceOf,
  formatAzimuth,
  horizonOf,
  historyTrack,
  mansionsAt,
  moonPhaseName,
  riseSet,
  skyAt,
  starPlace,
  towards,
  bodyFaces,
  gridAt,
  STAR_NAMES,
  trackOf,
  tracksAt,
  type SkyBody,
  type SkyStar,
} from '../lib/sky'
import { eclipseShade, type SkyEvent } from '../lib/skyEvents'
import { useSkyEventText } from './SkyForecast'
import { canPoint, useDevicePointing } from './useDevicePointing'
import { MANSIONS, ZONES, mansionOf, mansionWidth, type MansionZone } from '../lib/mansions'
import { XINGGUAN } from '../lib/xingguan'
import { FIVE_STARS } from '../lib/fiveStars'
import { lightTime } from '../lib/solarSystem'
import { useSettings, useT, useTerm } from '../settingsContext'
import { DateParts } from './BirthForm'
import { TitleMark } from './Logo'
import { DrawerPageTab } from './SavedCharts'
import { useDismiss } from './useDismiss'
import { play } from '../sound'
import { C, PSF, PALETTE, R, colourIndex, glowRadius, mixWhite, paintSky, starAlpha, starColour } from './skyPaint'
import { BodyFaceView, SkyFaceDefs } from './SkyBodyFace'
import { SkyGlobe, canDrawGlobes, globeExtent } from './SkyGlobe'
import { SkyNight } from './SkyNight'
import { gliding, lookAt, SkyDome, stopGlide } from './SkyDome'
import { degreesApart, type DomeView } from '../lib/domeProjection'
import { paintClouds } from './skyClouds'
import { BORTLE } from '../lib/stargazing'
import { fetchForecast, weatherAt, type WeatherHour } from '../lib/weather'
import { BODY_INTRO, CHINA_INTRO, STAR_INTRO, WESTERN_INTRO } from '../lib/skyIntros'
import { KIND_NAME, MESSIER, MESSIER_INTRO, messierAt, messierConstellation, messierName, type Messier } from '../lib/messier'
import { SkySearch, type SearchItem } from './SkySearch'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** A star's size for what is placed round it (its name, the chosen ring), in map units at the full view */
const starRadius = (mag: number) => Math.max(0.6, 3.2 - 0.55 * mag)

/** How large each planet's face is, against Jupiter's, once zoomed in to show it */
const PLANET_SIZE: Partial<Record<string, number>> = { jupiter: 1, saturn: 0.84, venus: 0.62, mars: 0.42, mercury: 0.3, uranus: 0.36, neptune: 0.34 }
/** The Sun's and Moon's discs (map units at the full view); a planet's own size is worked out with the zoom */
const bodyRadius = (b: SkyBody) => (b.key === 'sun' ? 8 : b.key === 'moon' ? 7 : Math.min(5, Math.max(2.4, 3.6 - 0.35 * b.mag)))
/** Dragging the sky across the disc turns the time by six hours (later to the right, as the stars go) */
const DRAG_MINUTES = 360 / (2 * R)
/** How far the map zooms: from fitting its window to eight times that */
/** The meteors round a radiant: their direction, when they start and how far out */
const RADIANT_TRAILS = [
  [20, 0, 6],
  [85, 2.3, 30],
  [140, 0.9, 12],
  [205, 3.4, 22],
  [265, 1.6, 4],
  [320, 4.2, 26],
] as const

/** How wide 对准天空 shows the sky (degrees across the screen's shorter side), about a phone camera's */
const POINT_FOV = 70
/** 对准天空: once the sky is dragged aside, how far (degrees) the phone must turn from where it
 *  pointed then, as when it is shaken or turned, before the view goes back to following it */
const SHAKE = 8
/** How wide the dome view looks on something found by searching: a figure whole, a deep-sky object close */
const FIND_FOV = { fig: 90, dso: 40, other: 60 }
const Z_MIN = 1
const Z_MAX = 8

// Paths: where each body goes from 12 hours before the moment shown to 12
// hours after, sampled every 10 minutes, with a dot on each whole local hour.
const PATH_SPAN = 12 * 3600_000
const PATH_STEP = 10 * 60_000
const HOUR = 3600_000
const PATHS_KEY = 'chroniq-sky-paths'
/** Kilometres in an astronomical unit */
const AU_KM = 149_597_870.7

// Constellation figures: Western, the Chinese 星官, the 二十八宿 alone, or none
type FigureSet = 'none' | 'west' | 'china' | 'mansions'
/** The 28 mansions' figures (rank 1 in the 星官), each with its mansion, for its 四象 colour */
const MANSION_FIGURES = XINGGUAN.filter((c) => c.rank === 1)
const MANSION_BY_NAME = new Map(MANSIONS.map((x, i) => [x.name, { ...x, index: i }]))
/** 角宿 → 角宿 / 角宿 in the 星官 data's 繁體 */
const MANSION_TRAD = new Map(MANSION_FIGURES.map((c) => [c.name, c.trad]))
const zoneOf = (name: string): MansionZone | undefined => MANSION_BY_NAME.get(name)?.zone
const FIGURES_KEY = 'chroniq-sky-figures'
const QUALITY_KEY = 'chroniq-sky-quality'
const BORTLE_KEY = 'chroniq-sky-bortle'
const WEATHER_KEY = 'chroniq-sky-weather'
const DSO_KEY = 'chroniq-sky-dso'
const NIGHT_KEY = 'chroniq-sky-night'
const GROUND_KEY = 'chroniq-sky-ground'
const EQ_GRID_KEY = 'chroniq-sky-eqgrid'
const ECLIPTIC_KEY = 'chroniq-sky-ecliptic'
const RED_KEY = 'chroniq-sky-red'

/** 时间流动: how fast the time runs, in minutes of sky per second (negative: backwards) */
const SPEEDS = [-360, -60, -10, -1, 0, 1, 10, 60, 360]

/** A switch remembered in this browser */
function usePref(key: string, initial: boolean): [boolean, () => void] {
  const [on, setOn] = useState(() => {
    try {
      const v = localStorage.getItem(key)
      return v === null ? initial : v === 'on'
    } catch {
      return initial
    }
  })
  const toggle = () =>
    setOn((v) => {
      try {
        localStorage.setItem(key, v ? 'off' : 'on')
      } catch {
        // storage unavailable: lasts for this visit
      }
      return !v
    })
  return [on, toggle]
}

/** A deep-sky object's size on the map (map units at the full view, near the zenith): half its long axis */
const dsoRadius = (m: Messier) => ((m.size[0] / 60 / 2) * R) / 90

const pad = (n: number) => String(n).padStart(2, '0')
/** A sentence with elements (links) put in its {slots}, as the text came from t() with them kept */
const withSlots = (text: string, nodes: Record<string, ReactNode>) =>
  text.split(/\{(\w+)\}/).map((part, i) => (i % 2 ? <Fragment key={i}>{nodes[part]}</Fragment> : part))
const ymd = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month, day }
}

/** A moment to open the sky at, perhaps for an event: when, what to pick out (and which figures that is among), and how close */
export interface SkyMoment {
  event?: SkyEvent
  time: number
  chosen?: string
  /** A second body in it, picked out too */
  also?: string
  figures?: FigureSet
  zoom?: number
}

const wallFormats = new Map<string, Intl.DateTimeFormat>()
/** Wall-clock date and time of an instant in a time zone, as the inputs want them */
function wallTime(d: Date, timeZone: string) {
  let format = wallFormats.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    wallFormats.set(timeZone, format)
  }
  const parts = Object.fromEntries(
    format
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

/**
 * 此刻天空: the real sky above the 天象 page's place — the Sun, Moon, planets and
 * stars to magnitude 5 that are above the horizon. It follows the present
 * moment until a date or time is picked (read in the place's time zone).
 */
export function SkyView({ place, placeControls, moment }: { place: StarPlace; placeControls?: ReactNode; moment?: SkyMoment | null }) {
  const t = useT()
  const term = useTerm()
  const { language, script } = useSettings()
  const en = language === 'en'
  const azimuth = (az: number) => formatAzimuth(az, language)
  const [now, setNow] = useState(() => new Date())
  const [picked, setPicked] = useState<{ date: string; time: string } | null>(() => (moment ? wallTime(new Date(moment.time), place.timeZone) : null))
  useEffect(() => {
    if (picked) return
    // Not while the tab is hidden (each tick redraws the whole sky); catch up when it is shown again
    const tick = () => !document.hidden && setNow(new Date())
    const id = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [picked])

  const wall = picked ?? wallTime(now, place.timeZone)
  const utc = useMemo(() => {
    if (!picked) return now
    const [y, m, d] = picked.date.split('-').map(Number)
    const [hh, mm] = picked.time.split(':').map(Number)
    return toUtc({ year: y, month: m, day: d, hour: hh || 0, minute: mm || 0 }, place.timeZone).date
  }, [picked, now, place.timeZone])
  // 时间流动: the sky runs on by itself, faster or slower than the clock or backwards, from the moment
  // shown; a time set meanwhile (typed, dragged, picked) carries on from there
  const [speed, setSpeed] = useState(0)
  const utcRef = useRef(utc)
  utcRef.current = utc
  const pickedRef = useRef(picked)
  pickedRef.current = picked
  useEffect(() => {
    if (!speed) return
    const minute = (ms: number) => Math.floor(ms / 60_000) * 60_000
    const start = () => ({ from: minute(utcRef.current.getTime()), at: performance.now() })
    let flow = start()
    let lastTick = performance.now()
    // Where it started, and the moments it has set lately (some may not be drawn yet): any other was set elsewhere
    let base = pickedRef.current
    const ours: NonNullable<typeof picked>[] = []
    const tick = () => {
      const now = performance.now()
      const gap = now - lastTick
      lastTick = now
      // Set elsewhere (typed, dragged, picked), or the tab was away (its timers held back): on from
      // what is shown now
      const shown = pickedRef.current
      if ((shown !== base && !(shown && ours.includes(shown))) || gap > 1500) {
        flow = start()
        base = shown
        ours.length = 0
        return
      }
      const ms = flow.from + Math.round(((now - flow.at) / 1000) * speed) * 60_000
      const next = wallTime(new Date(ms), place.timeZone)
      const last = ours[ours.length - 1] ?? base
      if (last && last.date === next.date && last.time === next.time) return
      ours.push(next)
      if (ours.length > 8) ours.shift()
      setPicked(next)
    }
    const id = setInterval(tick, Math.max(100, 1000 / Math.abs(speed)))
    return () => clearInterval(id)
  }, [speed, place.timeZone])
  /** Faster (or less backwards), or slower (towards backwards) */
  const changeSpeed = (step: 1 | -1) =>
    setSpeed((v) => SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, SPEEDS.indexOf(v) + step))])
  // Running fast, the sky is drawn as while dragged: what is slow to work out waits until it stops
  const flowing = Math.abs(speed) >= 10
  // 头顶 / 脚下: the half of the sky above the horizon, or the half beneath one's feet, seen as if
  // through the Earth: the nadir in the middle, and east and west swapped (looking down, east is right).
  const [below, setBelow] = useState(false)
  // 穹顶视角 (SkyDome): the sky as one stands under it, looking one way, the ground see-through; chosen
  // in 显示, and always while the phone is pointed at the sky (对准天空)
  const [dome, setDome] = useState(false)
  const domeView = useRef<DomeView>({ az: 180, alt: 35, fov: 100 })
  const shown = (alt: number) => (below ? alt < 0 : alt >= 0)
  const at = (az: number, alt: number) => projectSky(az, alt, below)
  const sky = useMemo(() => skyAt(utc, place.latitude, place.longitude, below), [utc, place.latitude, place.longitude, below])

  // ---- The sky as the page's backdrop ----
  // The map fills the screen behind the page (in <body>), fitted at first to the empty "window"
  // the page leaves for it: the controls and the table float beside it. On a wide screen the page
  // holds still (sticky, as the calendar does) and the footer slides up over it when scrolled to;
  // on a phone the page scrolls up over the sky, which stays where the window was at the top.
  const windowRef = useRef<HTMLDivElement>(null)
  // 对准天空: the phone shows the part of the sky it points at, over the whole screen
  const [pointingOn, setPointingOn] = useState(false)
  // The dome view (穹顶, and 对准天空 always) draws its own sky. While it shows, what only the flat map
  // draws (its figures, grid, paths, labels, globes, Milky Way and faint stars) stays at the moment
  // it was left, rather than being worked out again each step of the time running on, and is
  // brought up to date when the map comes back
  const domeOn = dome || pointingOn
  const flatUtcRef = useRef(utc)
  if (!domeOn) flatUtcRef.current = utc
  const flatUtc = flatUtcRef.current
  const [measuredFrame, setFrame] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const frame = pointingOn ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } : measuredFrame
  const frameRef = useRef(frame)
  frameRef.current = frame
  useLayoutEffect(() => {
    const el = windowRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const stuck = getComputedStyle(el.closest('main') ?? el).position === 'sticky'
      const next = { left: r.left, top: r.top + (stuck ? 0 : window.scrollY), width: r.width, height: r.height }
      setFrame((f) =>
        f && Math.abs(f.left - next.left) < 0.5 && Math.abs(f.top - next.top) < 0.5 && Math.abs(f.width - next.width) < 0.5 && Math.abs(f.height - next.height) < 0.5
          ? f
          : next,
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(document.body)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  // Zoom and pan, the map alone: z 1 fits the window; x, y move the disc's centre from the window's
  // centre (screen pixels). Text keeps its size on screen, and stars and bodies grow only as the
  // square root of the zoom, so zooming in spreads them apart.
  const [view, setView] = useState({ z: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  const fit = frame && Math.min(frame.width, frame.height) > 100 ? Math.min(frame.width, frame.height) / (2 * C) : 1
  const scale = fit * view.z
  const k = Math.round((1 / scale) * 1000) / 1000
  const kRef = useRef(k)
  kRef.current = k
  const dot = Math.round((1 / Math.sqrt(view.z)) * 100) / 100
  // A planet is a point of light far out (glowing as bright as it is), and opens into its face once
  // zoomed in: the face's radius in screen pixels, 0 until then
  const faceSize = (key: string) => (PLANET_SIZE[key] ?? 0) * fit * 4.2 * Math.max(0, view.z - 1.4)
  /** The Sun's or Moon's disc, or a planet's face (map units): zoomed in, the Sun and Moon stay well
   *  larger than Jupiter, as they are */
  const discOf = (b: SkyBody) =>
    b.key === 'sun' || b.key === 'moon' ? Math.max(bodyRadius(b) * dot, 1.9 * faceSize('jupiter') * k) : faceSize(b.key) * k
  /** The globe's half-width (map units) where a body is drawn as a globe: the Moon always, a planet
   *  once its face is a few pixels across; none where the browser cannot draw them */
  const globeOf = (b: SkyBody) =>
    b.key !== 'sun' && faces[b.key] && canDrawGlobes() && (b.key === 'moon' || faceSize(b.key) >= 6)
      ? discOf(b) * globeExtent(b.key)
      : null
  /** Turn (degrees) that sets a globe's zenith-up picture upright at a point on the map */
  const upTurn = (x: number, y: number) =>
    Math.hypot(x - C, y - C) < 0.01 ? 0 : (Math.atan2(below ? y - C : C - y, below ? x - C : C - x) * 180) / Math.PI + 90
  /** A body's size for what goes round it (its name, the ring, where it can be clicked), map units */
  const bodySize = (b: SkyBody) =>
    b.key === 'sun' || b.key === 'moon' ? discOf(b) : Math.max(glowRadius(b.mag) * dot * 0.32, discOf(b) * (b.key === 'saturn' ? 2.2 : 1))
  const centre = frame ? [frame.left + frame.width / 2 + view.x, frame.top + frame.height / 2 + view.y] : [C, C]
  /** Keeps the zoom in range, and the window's centre on the sky: zoomed in twice or more, as far out
   *  as the horizon (so what has just risen, or is about to set, can be looked at in the middle); at
   *  full size, fixed */
  const clampView = (v: { z: number; x: number; y: number }) => {
    const f = frameRef.current
    const z = Math.min(Z_MAX, Math.max(Z_MIN, v.z))
    const room = f ? (R * Math.min(f.width, f.height) * Math.min(z, 2 * (z - 1))) / (2 * C) : 0
    const off = Math.hypot(v.x, v.y)
    const keep = off > room ? room / off : 1
    return { z, x: v.x * keep, y: v.y * keep }
  }
  // Opened at an event that wants a close look: zoomed in on it, once the window is measured
  const zoomedIn = useRef(false)
  useEffect(() => {
    if (!frame || !moment?.zoom || !moment.event || zoomedIn.current) return
    zoomedIn.current = true
    const [x, y] = at(moment.event.azimuth, moment.event.altitude)
    const s = fit * moment.zoom
    setView(clampView({ z: moment.zoom, x: (C - x) * s, y: (C - y) * s }))
  }, [frame])

  // 画质 (remembered in this browser): 清晰 draws the sky in full; 流畅 for a slower computer or
  // phone draws less of it (the star clouds as their cells and thinned, no stars past magnitude 6,
  // at the screen's CSS pixels; no twinkling or shooting stars), so zooming and dragging keep up
  const [quality, setQuality] = useState<'clear' | 'smooth'>(() => {
    try {
      return localStorage.getItem(QUALITY_KEY) === 'smooth' ? 'smooth' : 'clear'
    } catch {
      return 'clear'
    }
  })
  // 对准天空 draws a far larger canvas again and again, on a phone: always the lighter sky
  const smooth = quality === 'smooth' || pointingOn
  const pickQuality = (v: 'clear' | 'smooth') => {
    setQuality(v)
    try {
      localStorage.setItem(QUALITY_KEY, v)
    } catch {
      // storage unavailable: lasts for this visit
    }
  }
  // While the wheel turns, fingers pinch or the map is dragged, the view on screen runs ahead of the
  // one drawn: the drawn map (both its layers and the twinkles) is moved and scaled as a whole by one
  // transform, which the compositor does without drawing anything again. When the gesture rests,
  // the view is drawn properly (labels back to their size, stars to theirs) and the transform goes,
  // in the same frame. Drawing the whole map anew for every step of a zoom was what made it judder.
  const zoomerRef = useRef<HTMLDivElement>(null)
  const live = useRef<typeof view | null>(null)
  const settle = useRef(0)
  const early = useRef(0)
  const tween = useRef(0)
  // The drawn layers reach this far past the screen on every side (px), so a drag or a zoom out shows
  // sky already drawn rather than the dark behind it; less of it for 流畅, which draws less
  // Turned for 对准天空, the corners of the screen reach further: what is drawn covers a circle round it
  const over = pointingOn
    ? Math.ceil((Math.hypot(window.innerWidth, window.innerHeight) - Math.min(window.innerWidth, window.innerHeight)) / 2)
    : Math.round(Math.max(window.innerWidth, window.innerHeight) * (smooth ? 0.08 : 0.15))
  const overRef = useRef(over)
  overRef.current = over
  // The labels keep their size on screen meanwhile, as they will have once drawn again, rather than
  // growing with the map and shrinking back when it rests. Set on each label (once above them would
  // restyle the whole map), and at most every 100 ms: laying the labels out again costs ~15 ms
  const labelsAt = useRef(0)
  const labelsLater = useRef(0)
  const sizeLabels = (g: number) => {
    const el = zoomerRef.current
    if (!el) return
    clearTimeout(labelsLater.current)
    const wait = labelsAt.current + 100 - performance.now()
    if (wait > 0) {
      labelsLater.current = window.setTimeout(() => live.current && sizeLabels(live.current.z / viewRef.current.z), wait)
      return
    }
    labelsAt.current = performance.now()
    const kg = String(kRef.current / g)
    for (const label of el.querySelectorAll<SVGTextElement>('text')) label.style.setProperty('--k', kg)
  }
  /** The view on screen: the one a gesture has reached, or the one drawn */
  const current = () => live.current ?? viewRef.current
  /** Moves the drawn map (drawn at viewRef's view) to show another; true if the drawn layers, past
   *  the screen as they are, no longer cover it */
  const shift = (next: typeof view) => {
    const f = frameRef.current!
    const el = zoomerRef.current!
    const v = viewRef.current
    const g = next.z / v.z
    const [wx, wy] = [f.left + f.width / 2, f.top + f.height / 2]
    const [tx, ty] = [wx + next.x - (wx + v.x) * g, wy + next.y - (wy + v.y) * g]
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${g})`
    sizeLabels(g)
    if (!el.classList.contains('moving')) el.classList.add('moving')
    const m = overRef.current
    const [w, h] = [window.innerWidth, window.innerHeight]
    return tx - g * m > 0 || ty - g * m > 0 || tx + g * (w + m) < w || ty + g * (h + m) < h
  }
  /** Shows a view at once by moving the drawn map; draws it properly after `rest` ms without another
   *  (long enough that the notches of a wheel spun on a slow machine still count as one gesture) */
  /** A zoom or pan under way, drawn so far only the quick way (rough canvas, no faint star field) */
  const [moving, setMoving] = useState(false)
  const preview = (next: typeof view, rest = 250) => {
    if (!frameRef.current || !zoomerRef.current) return setView(next)
    live.current = next
    // Moved past what is drawn: drawn soon, while the gesture goes on, rather than showing the dark
    // until it rests (not put off by the gesture's further steps, as the rest is)
    // That drawing is the quick one (as while dragging), as the gesture is still going: the full sky
    // is drawn once it rests
    if (shift(next) && !early.current)
      early.current = window.setTimeout(() => {
        early.current = 0
        if (live.current) {
          setMoving(true)
          setView(live.current)
        }
      }, 60)
    if (tipRef.current?.classList.contains('on')) tipRef.current.classList.remove('on')
    clearTimeout(settle.current)
    settle.current = window.setTimeout(() => {
      if (live.current) setView(live.current)
      setMoving(false)
    }, rest)
  }
  // A view has been drawn: if it is the one shown, the transform goes before the frame is painted;
  // if the gesture went on meanwhile, the transform now starts from the view just drawn
  useLayoutEffect(() => {
    const el = zoomerRef.current
    if (!el) return
    if (live.current && live.current !== view) {
      // Labels drawn anew have no size of their own yet: set at once
      labelsAt.current = 0
      shift(live.current)
      return
    }
    live.current = null
    el.style.transform = ''
    clearTimeout(labelsLater.current)
    labelsAt.current = 0
    for (const label of el.querySelectorAll<SVGTextElement>('text')) label.style.removeProperty('--k')
    el.classList.remove('moving')
  }, [view])
  useEffect(() => () => {
    clearTimeout(settle.current)
    clearTimeout(early.current)
    clearTimeout(labelsLater.current)
    cancelAnimationFrame(tween.current)
  }, [])
  /** The view zoomed by a factor about a point on the screen, which stays where it is */
  const zoomedAt = (v: typeof view, fx: number, fy: number, factor: number) => {
    const f = frameRef.current!
    const z = Math.min(Z_MAX, Math.max(Z_MIN, v.z * factor))
    const wx = f.left + f.width / 2
    const wy = f.top + f.height / 2
    const grow = z / v.z
    return clampView({ z, x: fx - (fx - (wx + v.x)) * grow - wx, y: fy - (fy - (wy + v.y)) * grow - wy })
  }
  const zoomAt = (fx: number, fy: number, factor: number) => {
    if (!frameRef.current) return
    cancelAnimationFrame(tween.current)
    preview(zoomedAt(current(), fx, fy, factor))
  }
  /** Glides to a view (the zoom buttons), then draws it; with reduced motion, draws it at once */
  const glideTo = (target: typeof view) => {
    const from = current()
    const start = performance.now()
    cancelAnimationFrame(tween.current)
    if (reducedMotion()) {
      clearTimeout(settle.current)
      live.current = null
      return setView(target)
    }
    const step = (now: number) => {
      const a = Math.min(1, (now - start) / 240)
      const e = 1 - (1 - a) ** 3
      const z = from.z * (target.z / from.z) ** e
      preview({ z, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e }, a < 1 ? 1000 : 0)
      if (a < 1) tween.current = requestAnimationFrame(step)
    }
    tween.current = requestAnimationFrame(step)
  }
  /** The zoom buttons: about the middle of the window, so what is looked at stays there */
  const zoomBy = (factor: number) => {
    const f = frameRef.current
    if (f) glideTo(zoomedAt(current(), f.left + f.width / 2, f.top + f.height / 2, factor))
  }

  // On a phone, the time bar above the sky unfolded (folded to one line at first)
  const [timeOpen, setTimeOpen] = useState(false)
  // 地点 in the bar above the sky opens the place's details under it; a click elsewhere or Esc shuts them
  const [placeOpen, setPlaceOpen] = useState(false)
  const placeRef = useRef<HTMLDivElement>(null)
  useDismiss(placeRef, placeOpen, () => setPlaceOpen(false))

  // The bodies' paths across the sky, on unless switched off (remembered in this browser)
  // 光污染: how dark the place's sky is, on the Bortle scale (remembered in this browser)
  const [bortle, setBortle] = useState(() => {
    try {
      const v = Number(localStorage.getItem(BORTLE_KEY))
      return v >= 1 && v <= 9 ? v : 2
    } catch {
      return 2
    }
  })
  const pickBortle = (v: number) => {
    setBortle(v)
    try {
      localStorage.setItem(BORTLE_KEY, String(v))
    } catch {
      // storage unavailable: lasts for this visit
    }
  }
  // 云量: the cloud forecast, once switched on (it asks Open-Meteo, sending the place's latitude and
  // longitude; remembered in this browser)
  const [weatherOn, setWeatherOn] = useState(() => {
    try {
      return localStorage.getItem(WEATHER_KEY) === 'on'
    } catch {
      return false
    }
  })
  const toggleWeather = () =>
    setWeatherOn((on) => {
      try {
        localStorage.setItem(WEATHER_KEY, on ? 'off' : 'on')
      } catch {
        // storage unavailable: lasts for this visit
      }
      return !on
    })
  const [weather, setWeather] = useState<{ hours: WeatherHour[]; failed: boolean }>({ hours: [], failed: false })
  useEffect(() => {
    if (!weatherOn) return setWeather({ hours: [], failed: false })
    let gone = false
    fetchForecast(place.latitude, place.longitude)
      .then((hours) => !gone && setWeather({ hours, failed: false }))
      .catch(() => !gone && setWeather({ hours: [], failed: true }))
    return () => {
      gone = true
    }
  }, [weatherOn, place.latitude, place.longitude])

  // 深空天体, the equatorial grid, the ecliptic and the red night light (remembered in this browser)
  const [showDso, toggleDso] = usePref(DSO_KEY, true)
  const [eqGrid, toggleEqGrid] = usePref(EQ_GRID_KEY, false)
  const [showEcliptic, toggleEcliptic] = usePref(ECLIPTIC_KEY, false)
  const [red, toggleRed] = usePref(RED_KEY, false)
  // 穹顶视角's ground: a see-through shade, or none
  const [showGround, toggleGround] = usePref(GROUND_KEY, true)
  // 今晚观星: the night's hours, over the bodies' table, only when asked for in 显示
  const [showNight, toggleNight] = usePref(NIGHT_KEY, false)
  // 红光夜视: the whole page in dim red, which keeps the eyes used to the dark (as at a telescope)
  useEffect(() => {
    document.documentElement.classList.toggle('night-red', red)
    return () => document.documentElement.classList.remove('night-red')
  }, [red])
  // 跟踪: the map keeps the chosen one in its middle as the time runs
  const [tracking, setTracking] = useState(false)

  const [showPaths, setShowPaths] = useState(() => {
    try {
      return localStorage.getItem(PATHS_KEY) !== 'off'
    } catch {
      return true
    }
  })
  const togglePaths = () =>
    setShowPaths((on) => {
      try {
        localStorage.setItem(PATHS_KEY, on ? 'off' : 'on')
      } catch {
        // storage unavailable: lasts for this visit
      }
      return !on
    })
  // The body or named star under the pointer (or its row, or keyboard focus): lit up at once, also
  // while another is chosen, with its path and hours picked out beside the chosen one's
  const [focus, setFocus] = useState<string | null>(null)
  const focusProps = (key: string) => ({
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === 'mouse' && setFocus(key),
    onPointerLeave: (e: React.PointerEvent) => e.pointerType === 'mouse' && setFocus((f) => (f === key ? null : f)),
    onFocus: () => setFocus(key),
    onBlur: () => setFocus((f) => (f === key ? null : f)),
  })
  // The body or named star picked out (click it, its name or a body's row; the key is its label's):
  // it pops up a size inside a ring and the rest dims. Click it again, the empty sky or press Esc to let go.
  const [chosen, setChosen] = useState<string | null>(moment?.chosen ?? null)
  const choose = (key: string) => setChosen((c) => (c === key ? null : key))
  const chooseKeys = (key: string) => (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    choose(key)
  }
  const chooseProps = (key: string) => ({
    role: 'button',
    tabIndex: 0,
    'aria-pressed': chosen === key,
    'data-sound': chosen === key ? 'unpick' : 'pick',
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation()
      choose(key)
    },
    onKeyDown: chooseKeys(key),
  })
  useEffect(() => {
    if (!chosen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setChosen(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [chosen])
  // Constellation figures (remembered in this browser)
  const [figures, setFigures] = useState<FigureSet>(() => {
    // For this visit only: a shower's constellation is among the western ones
    if (moment?.figures) return moment.figures
    try {
      const v = localStorage.getItem(FIGURES_KEY)
      return v === 'china' || v === 'none' || v === 'mansions' ? v : 'west'
    } catch {
      return 'west'
    }
  })
  // Another set chosen: its lines draw themselves in and its names fade in (a class on the map for
  // as long as that takes; the layer is keyed by the set, so all of it is new)
  const [figuresSwitched, setFiguresSwitched] = useState(false)
  const switchTimer = useRef(0)
  useEffect(() => () => clearTimeout(switchTimer.current), [])
  const pickFigures = (v: FigureSet) => {
    if (v !== figures) {
      setFiguresSwitched(true)
      clearTimeout(switchTimer.current)
      switchTimer.current = window.setTimeout(() => setFiguresSwitched(false), 1600)
    }
    setFigures(v)
    try {
      localStorage.setItem(FIGURES_KEY, v)
    } catch {
      // storage unavailable: lasts for this visit
    }
  }
  const figureViews = useMemo(
    () =>
      figures === 'none'
        ? []
        : constellationsAt(
            figures === 'west' ? WESTERN : figures === 'mansions' ? MANSION_FIGURES : XINGGUAN,
            flatUtc,
            place.latitude,
            place.longitude,
            below,
          ),
    [figures, flatUtc, place.latitude, place.longitude, below],
  )
  // 二十八宿: the mansions' boundaries along the equator, with their names (lib/sky.ts mansionsAt)
  const mansionView = useMemo(
    () => (figures === 'mansions' ? mansionsAt(flatUtc, place.latitude, place.longitude) : null),
    [figures, flatUtc, place.latitude, place.longitude],
  )
  const mansionName = (name: string) => (script === 'trad' ? (MANSION_TRAD.get(name) ?? name) : name)
  // 星官 names stay Chinese in English, as proper nouns; both sets follow the 繁體 / 简体 setting
  const figureName = (c: { name: string; trad: string; en: string }) =>
    figures === 'west' && en ? c.en : script === 'trad' ? c.trad : c.name
  // A 星官's English gloss goes with its name in English
  const figureTip = (c: { name: string; trad: string; en: string }) =>
    figures === 'mansions'
      ? `${figureName(c)} · ${en ? c.en : (MANSION_BY_NAME.get(c.name)?.animal ?? '')}`
      : figures === 'china' && en
        ? `${figureName(c)} · ${c.en}`
        : figureName(c)

  // 搜索: everything that can be found by name, and going to it: the map turns to the half of the
  // sky it is on, glides to it and zooms in, and it is chosen (and followed as the time runs)
  const figureSet = figures === 'none' ? 'west' : figures
  const searchItems = useMemo((): SearchItem[] => {
    const set = figureSet === 'west' ? WESTERN : figureSet === 'mansions' ? MANSION_FIGURES : XINGGUAN
    return [
      ...sky.bodies.map((b) => ({ key: b.key, label: t(b.name), sub: b.key === 'sun' ? t('恒星') : b.key === 'moon' ? t('卫星') : t('行星'), names: [b.name, t(b.name), term(b.name), b.key], colour: BODY_COLOUR[b.key] })),
      ...Object.entries(STAR_NAMES).map(([hip, name]) => ({ key: `hip${hip}`, label: t(name), sub: t('恒星'), names: [name, t(name), term(name), `HIP ${hip}`], colour: '#fff3d6' })),
      ...MESSIER.map((m) => ({
        key: `dso${m.n}`,
        label: messierName(m, en),
        sub: `M${m.n} · ${t(KIND_NAME[m.kind])}`,
        names: [`M${m.n}`, `Messier ${m.n}`, m.desig, m.zh, m.en, term(m.zh)].filter(Boolean),
        colour: DSO_COLOUR[m.kind],
      })),
      ...set.map((c) => ({
        key: `fig${c.id}`,
        label: figureSet === 'west' && en ? c.en : script === 'trad' ? c.trad : c.name,
        sub: figureSet === 'west' ? t('西方星座') : figureSet === 'mansions' ? t('二十八宿') : t('中国星官'),
        names: [c.name, c.trad, c.en, ...(figureSet === 'west' ? [c.id] : [])],
        colour: '#9fb6ff',
      })),
    ]
    // t and term change only with the settings
  }, [figureSet, language, script])
  /** Where something that can be chosen is now: a body, a named star, a Messier object or a figure's label */
  const whereIs = (key: string): { az: number; alt: number } | null => {
    if (!/^(hip|dso|fig)/.test(key)) return sky.bodies.find((b) => b.key === key) ?? null
    const toHorizon = horizonOf(utc, place.latitude, place.longitude)
    let p: { az: number; alt: number } | null = null
    if (key.startsWith('hip')) {
      const star = starPlace(Number(key.slice(3)))
      if (star) p = toHorizon(star.ra, star.dec)
    } else if (key.startsWith('dso')) {
      const m = MESSIER.find((x) => `dso${x.n}` === key)
      if (m) p = toHorizon(m.ra, m.dec)
    } else if (key.startsWith('fig')) {
      const set = figureSet === 'west' ? WESTERN : figureSet === 'mansions' ? MANSION_FIGURES : XINGGUAN
      const c = set.find((x) => `fig${x.id}` === key)
      if (c) p = toHorizon(...c.label)
    }
    return p
  }
  const goTo = (key: string) => {
    if (key.startsWith('fig') && figures === 'none') pickFigures('west')
    const p = whereIs(key)
    if (!p) return
    const under = p.alt < 0
    if (under !== below) setBelow(under)
    setChosen(key)
    setTracking(!key.startsWith('fig'))
    // Under the dome: turn round to it (with the phone pointing, the arrow at the edge shows the way)
    if (domeOn) {
      const kind = key.startsWith('fig') ? 'fig' : key.startsWith('dso') ? 'dso' : 'other'
      if (!pointingOn) lookAt(domeView, { az: p.az, alt: p.alt, fov: Math.min(domeView.current.fov, FIND_FOV[kind]) })
      return
    }
    const [x, y] = projectSky(p.az, p.alt, under)
    const z = Math.max(current().z, key.startsWith('fig') ? 1.8 : key.startsWith('dso') ? 3.2 : 2.4)
    glideTo(clampView({ z, x: (C - x) * fit * z, y: (C - y) * fit * z }))
  }

  // One body's way among the stars over the past days, drawn on tonight's sky: switched on in a
  // chosen body's details, it then follows whichever body is chosen
  const [history, setHistory] = useState({ on: false, days: 90 })
  const historyBody = history.on && chosen && !/^(hip|fig|dso)/.test(chosen) ? (chosen as SkyBody['key']) : null
  // While the sky is dragged through time, the paths and the history track (too slow to redo at
  // every step) wait until it is let go
  const [dragShift, setDragShift] = useState<number | null>(null)
  const dragging = dragShift !== null || flowing
  const historyPoints = useMemo(
    () => (historyBody && !dragging ? historyTrack(historyBody, utc, place.latitude, place.longitude, history.days) : null),
    [historyBody, history.days, dragging, utc, place.latitude, place.longitude],
  )
  // A date mark every week (1 month), half month (3 months) or month (1 year), counted back from now
  const historyTicks = (points: { utc: Date; az: number; alt: number }[]) => {
    const tickDays = history.days <= 31 ? 7 : history.days <= 92 ? 15 : 30
    const stride = Math.round(((points.length - 1) * tickDays) / history.days)
    const ticks = []
    for (let i = points.length - 1 - stride; i >= 0; i -= stride) {
      const [, m, d] = wallTime(points[i].utc, place.timeZone).date.split('-').map(Number)
      ticks.push({ ...points[i], m, d })
    }
    return ticks
  }
  const historyLine = useMemo(() => {
    if (!historyBody || !historyPoints || domeOn) return null
    const points = historyPoints
    return { key: historyBody, d: pathData(points, at), start: points[0], ticks: historyTicks(points) }
  }, [historyPoints, domeOn, place.timeZone])
  const dateLabel = (m: number, d: number) =>
    en ? new Date(Date.UTC(2000, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : `${m}/${d}`

  // The moments a path is drawn through: every 10 minutes from 12 hours before to 12 after, and
  // the whole local hours in that window (from the wall-clock minute, so odd offsets like +5:45 work)
  // While the sky is dragged through time the usual paths wait, so the moments are only needed then
  // for a chosen or hovered one's path
  const wantPathTimes = showPaths && (!dragging || chosen !== null || focus !== null)
  const pathTimes = useMemo(() => {
    if (!wantPathTimes) return null
    const now = utc.getTime()
    const times: Date[] = []
    for (let ms = now - PATH_SPAN; ms <= now + PATH_SPAN; ms += PATH_STEP) times.push(new Date(ms))
    const start = now - PATH_SPAN
    const minute = Number(wallTime(new Date(start), place.timeZone).time.slice(3))
    const hours: Date[] = []
    for (let ms = start - (start % 60_000) + ((60 - minute) % 60) * 60_000; ms <= now + PATH_SPAN; ms += HOUR) {
      hours.push(new Date(ms))
    }
    return { times, hours, hourOf: hours.map((h) => Number(wallTime(h, place.timeZone).time.slice(0, 2))) }
  }, [wantPathTimes, utc, place.timeZone])
  /** A path from its positions at pathTimes' moments followed by its hours */
  const pathOf = (key: string, track: { az: number; alt: number }[]) => {
    const { times, hourOf } = pathTimes!
    const nowAt = PATH_SPAN / PATH_STEP
    const line = track.slice(0, times.length)
    return {
      key,
      past: pathData(line.slice(0, nowAt + 1), at),
      future: pathData(line.slice(nowAt), at),
      hours: track
        .slice(times.length)
        .map((p, i) => ({ ...p, hour: hourOf[i] }))
        .filter((p) => shown(p.alt)),
    }
  }
  // The usual bodies' tracks through pathTimes' moments, for the map's paths or the dome's. Left out
  // while the sky is dragged through time (the chosen one's path stays: extraTrack)
  const pathTracks = useMemo(
    () => (pathTimes && !dragging ? tracksAt([...pathTimes.times, ...pathTimes.hours], place.latitude, place.longitude) : null),
    // dragging too: letting go must bring them back, though the time has not moved since the last step
    [pathTimes, dragging, place.latitude, place.longitude],
  )
  const paths = useMemo(() => (pathTracks && !domeOn ? PATH_BODIES.map((key) => pathOf(key, pathTracks[key])) : null), [pathTracks, domeOn])
  const clipId = useId()
  const pick = chosen?.startsWith('hip') ? sky.stars.find((s) => `hip${s.hip}` === chosen) : sky.bodies.find((b) => b.key === chosen)
  // A constellation or 星官 can be chosen too (its key is fig + its id)
  const pickFigure = chosen?.startsWith('fig') ? figureViews.find((c) => `fig${c.id}` === chosen) : undefined
  // The Messier objects on this half of the sky (all of them, for the search and a chosen one, even
  // with the layer off); a deep-sky object can be chosen too (its key is dso + its number)
  const dsos = useMemo(() => messierAt(utc, place.latitude, place.longitude, below), [utc, place.latitude, place.longitude, below])
  const pickDso = chosen?.startsWith('dso') ? dsos.find((d) => `dso${d.m.n}` === chosen) : undefined
  // A star that has set, or is on the other half of the sky now, lets go; so does a figure gone from view
  useEffect(() => {
    if (chosen && !pick && !pickFigure && !pickDso) setChosen(null)
  }, [chosen, pick, pickFigure, pickDso])
  useEffect(() => {
    if (!chosen) setTracking(false)
  }, [chosen])
  const pickName = pick && ('key' in pick ? t(pick.name) : t(pick.name!))
  const pickColour = pick ? ('key' in pick ? BODY_COLOUR[pick.key] : starColour(pick.bv)) : pickDso && DSO_COLOUR[pickDso.m.kind]
  /** How large a deep-sky object's mark is: its true size, but never too small to see */
  const dsoMark = (m: Messier) => Math.max(3.2 * dot, dsoRadius(m))
  const pickRadius = pick ? ('key' in pick ? bodySize(pick) : starRadius(pick.mag) * dot) : pickDso && dsoMark(pickDso.m)
  // Where the chosen one is on the map, if it is on this half of the sky
  const spot = pick && shown(pick.alt) ? at(pick.az, pick.alt) : pickDso ? at(pickDso.az, pickDso.alt) : null
  /** 跟踪 on: the map glides in to the chosen one first */
  const toggleTracking = () => {
    if (tracking) return setTracking(false)
    setTracking(true)
    if (!spot) return
    const z = Math.max(current().z, 2.4)
    glideTo(clampView({ z, x: (C - spot[0]) * fit * z, y: (C - spot[1]) * fit * z }))
  }
  // 跟踪: as the time moves, the map moves with the chosen one, before the frame is painted
  useLayoutEffect(() => {
    if (domeOn || !tracking || !spot || !frameRef.current || live.current) return
    const v = viewRef.current
    const s = fit * v.z
    const next = clampView({ z: v.z, x: (C - spot[0]) * s, y: (C - spot[1]) * s })
    if (Math.abs(next.x - v.x) > 0.5 || Math.abs(next.y - v.y) > 0.5) setView(next)
    // spot follows the time
  }, [utc, tracking])
  // 跟踪 under the dome: the view keeps looking at the chosen one as the time moves (not while it
  // glides there, nor while the phone is pointing it)
  useLayoutEffect(() => {
    if (!domeOn || pointingOn || !tracking || !chosen || gliding(domeView)) return
    const p = whereIs(chosen)
    if (p) domeView.current = { ...domeView.current, az: p.az, alt: p.alt }
    // whereIs follows the time and the place; a tap choosing something else does not turn the view
  }, [utc, tracking, domeOn, pointingOn])
  // What the dome view rings (or points to from its edge): the chosen one, named as the search names it
  const domeMark = (() => {
    if (!domeOn || !chosen) return null
    const p = whereIs(chosen)
    const item = searchItems.find((i) => i.key === chosen)
    return p ? { az: p.az, alt: p.alt, label: item?.label ?? chosen, colour: item?.colour ?? '#f4ce80' } : null
  })()
  // What the panel tells of the chosen body or star: what it is, when it rises and sets, which 宿 it
  // is in and how far off it is. Not worked out again at each step of a drag through time.
  const five = pick && 'key' in pick ? FIVE_STARS.find((f) => f.key === pick.key) : undefined
  const pickKind = !pick
    ? ''
    : !('key' in pick) || pick.key === 'sun'
      ? t('恒星')
      : pick.key === 'moon'
        ? t('卫星')
        : five
          ? t('行星 · 古称{name}，五行属{element}', { name: term(five.name), element: term(five.element) })
          : t('行星')
  const lastDetails = useRef<{
    times: ReturnType<typeof riseSet>
    mansion: (typeof MANSIONS)[number] | null
    distance: number | null
  } | null>(null)
  const details = useMemo(() => {
    if (!pick) return null
    if (dragging) return lastDetails.current
    const ra = 'key' in pick ? pick.ra : starPlace(pick.hip)?.ra
    return {
      times: riseSet('key' in pick ? { body: pick.key } : { hip: pick.hip }, utc, place.latitude, place.longitude, pick.alt > 0),
      mansion: ra === undefined ? null : mansionOf(ra).mansion,
      distance: 'key' in pick ? distanceOf(pick.key, utc) : null,
    }
    // pick follows chosen and the sky (utc, place)
  }, [chosen, dragging, utc, place.latitude, place.longitude])
  lastDetails.current = details
  // The same for a chosen deep-sky object: when it rises and sets, its 宿 and its constellation
  const lastDsoDetails = useRef<{
    times: ReturnType<typeof riseSet>
    mansion: (typeof MANSIONS)[number]
    constellation: (typeof WESTERN)[number] | undefined
  } | null>(null)
  const dsoDetails = useMemo(() => {
    if (!pickDso) return null
    if (dragging) return lastDsoDetails.current
    const m = pickDso.m
    return {
      times: riseSet({ ra: m.ra, dec: m.dec }, utc, place.latitude, place.longitude, pickDso.alt > 0),
      mansion: mansionOf(m.ra).mansion,
      constellation: WESTERN.find((c) => c.id === messierConstellation(m)),
    }
    // pickDso follows chosen and the sky
  }, [chosen, dragging, utc, place.latitude, place.longitude])
  lastDsoDetails.current = dsoDetails
  // The equatorial grid and the ecliptic, when either is on
  const grid = useMemo(
    () => (eqGrid || showEcliptic ? gridAt(flatUtc, place.latitude, place.longitude) : null),
    [eqGrid, showEcliptic, flatUtc, place.latitude, place.longitude],
  )
  /** A rise or set: its local time, marked if it falls on the day before or after */
  const clock = (d: Date | null) => {
    if (!d) return '—'
    const w = wallTime(d, place.timeZone)
    return w.date === wall.date ? w.time : w.date < wall.date ? t('前一日 {time}', { time: w.time }) : t('次日 {time}', { time: w.time })
  }
  const distanceText = (b: SkyBody, au: number) =>
    b.key === 'moon'
      ? // In 万 kilometres in Chinese, in kilometres in English
        t('约 {n} 万公里', { n: en ? (Math.round((au * AU_KM) / 1000) * 1000).toLocaleString('en') : ((au * AU_KM) / 1e4).toFixed(1) })
      : `${au.toFixed(au < 10 ? 2 : 1)} AU · ${t('光行 {time}', { time: lightTime(au, language) })}`
  /** A star's colour, and its surface temperature from it (Ballesteros' formula from B−V) */
  const starTone = (bv: number) => {
    const tone = bv < 0 ? t('蓝白') : bv < 0.3 ? t('白') : bv < 0.6 ? t('黄白') : bv < 1 ? t('黄') : bv < 1.4 ? t('橙') : t('橙红')
    const kelvin = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))
    return t('{tone} · 表面约 {k} K', { tone, k: (Math.round(kelvin / 100) * 100).toLocaleString('en') })
  }
  // The path of a star, or of a body without one among the usual (Uranus, Neptune), when it is
  // chosen or hovered, drawn like the others while the paths are on. While the sky is dragged
  // through time the usual paths wait, but the chosen one's is still drawn, whichever it is.
  // Tracks already worked out for these moments and this place, so hovering the same star again is free
  const trackCache = useMemo(() => new Map<string, { az: number; alt: number }[]>(), [pathTimes, place.latitude, place.longitude])
  /** The track of a chosen or hovered one that the usual paths leave out: a star, Uranus or Neptune,
   *  or any body while the sky is dragged through time */
  const extraTrack = (key: string | null) => {
    if (!pathTimes || !key || key.startsWith('fig') || key.startsWith('dso') || (PATH_BODIES.includes(key as SkyBody['key']) && !dragging)) return null
    let track = trackCache.get(key)
    if (!track) {
      const what = key.startsWith('hip') ? { hip: Number(key.slice(3)) } : { body: key as SkyBody['key'] }
      track = trackOf(what, [...pathTimes.times, ...pathTimes.hours], place.latitude, place.longitude)
      trackCache.set(key, track)
    }
    return track.length ? track : null
  }
  const extraPath = (key: string | null) => {
    const track = domeOn ? null : extraTrack(key)
    return track && key ? pathOf(key, track) : null
  }
  const chosenPath = useMemo(() => extraPath(chosen), [pathTimes, dragging, chosen, domeOn, place.latitude, place.longitude])
  const hoverPath = useMemo(
    () => (focus === chosen || dragging ? null : extraPath(focus)),
    [pathTimes, dragging, focus, chosen, domeOn, place.latitude, place.longitude],
  )
  const allPaths = pathTimes && [...(paths ?? []), ...(chosenPath ? [chosenPath] : []), ...(hoverPath ? [hoverPath] : [])]
  // The paths picked out: the chosen one's, and the hovered one's
  const litPaths = allPaths?.filter((p) => p.key === chosen || p.key === focus) ?? []
  const colourOf = (key: string) => {
    const st = key.startsWith('hip') ? sky.stars.find((x) => `hip${x.hip}` === key) : undefined
    return st ? starColour(st.bv) : BODY_COLOUR[key]
  }
  // The same paths under the dome, as directions: the line through the day (12 hours either side,
  // `now` where it is now), its whole hours named, the chosen one's picked out
  const domePaths = (() => {
    if (!domeOn || !pathTimes) return null
    const n = pathTimes.times.length
    const make = (key: string, track: { az: number; alt: number }[]) => ({
      key,
      colour: BODY_COLOUR[key] ?? colourOf(key),
      line: track.slice(0, n),
      now: PATH_SPAN / PATH_STEP,
      hours: track.slice(n).map((p, i) => ({ ...p, label: t('{h}时', { h: pathTimes.hourOf[i] }) })),
      lit: key === chosen,
    })
    const out = pathTracks ? PATH_BODIES.map((key) => make(key, pathTracks[key])) : []
    const extra = extraTrack(chosen)
    if (extra && chosen) out.push(make(chosen, extra))
    return out
  })()
  const domeHistory =
    domeOn && historyBody && historyPoints
      ? {
          colour: BODY_COLOUR[historyBody],
          line: historyPoints,
          ticks: historyTicks(historyPoints).map((p) => ({ az: p.az, alt: p.alt, label: dateLabel(p.m, p.d) })),
        }
      : null
  /** Where on the map the thing a path belongs to is now */
  const whereNow = (key: string) => {
    const o = key.startsWith('hip') ? sky.stars.find((st) => `hip${st.hip}` === key) : sky.bodies.find((b) => b.key === key)
    return o && shown(o.alt) ? at(o.az, o.alt) : null
  }
  const up = sky.bodies.filter((b) => shown(b.alt))
  // 对准天空: each reading turns the map at once and moves it without drawing it again (preview),
  // keeping the zenith up from what the phone looks at
  const turnerRef = useRef<HTMLDivElement>(null)
  // Each reading turns the dome view to where the phone points, under the horizon too (drawn on the
  // next frame, without rendering the page again)
  // The sky can be dragged aside to look about while the phone is held still: the view stays where
  // it was dragged until the phone turns SHAKE degrees from where it pointed when the drag began (a
  // shake, or turning to look elsewhere), and then follows the phone again
  const sensed = useRef<{ az: number; alt: number } | null>(null)
  const held = useRef<{ az: number; alt: number } | null>(null)
  const [heldOn, setHeldOn] = useState(false)
  const letGo = () => {
    held.current = null
    setHeldOn(false)
    stopGlide(domeView)
    if (sensed.current) domeView.current = { ...sensed.current, fov: domeView.current.fov }
  }
  const pointing = useDevicePointing((az, alt) => {
    sensed.current = { az, alt }
    const h = held.current
    if (h) {
      if (degreesApart(h, { az, alt }) < SHAKE) return
      return letGo()
    }
    domeView.current = { az, alt, fov: domeView.current.fov }
  })
  /** The dome view taken in hand: following stops; with the phone pointing, the view is held where dragged */
  const onLook = () => {
    setTracking(false)
    if (!pointingOn) return
    held.current = sensed.current ?? { az: domeView.current.az, alt: domeView.current.alt }
    setHeldOn(true)
  }
  const startPointing = () => {
    setBelow(false)
    domeView.current = { ...domeView.current, fov: POINT_FOV }
    setPointingOn(true)
    void pointing.start()
  }
  const stopPointing = () => {
    held.current = null
    setHeldOn(false)
    pointing.stop()
    setPointingOn(false)
    live.current = null
    clearTimeout(settle.current)
    setView({ z: 1, x: 0, y: 0 })
  }
  useEffect(() => {
    if (pointing.state === 'denied' || pointing.state === 'nocompass') setPointingOn(false)
  }, [pointing.state])
  useEffect(() => {
    document.documentElement.classList.toggle('sky-pointing', pointingOn)
    return () => document.documentElement.classList.remove('sky-pointing')
  }, [pointingOn])
  // The event opened from 天象预告, for as long as the sky stays within a day of it
  const [eventClosed, setEventClosed] = useState(false)
  const event = moment?.event && !eventClosed && Math.abs(utc.getTime() - moment.time) < 12 * 3600_000 ? moment.event : null
  const eventText = useSkyEventText(place)
  const shade = event && eclipseShade(event, utc.getTime())
  const radiant = event?.kind === 'meteors' && !below ? horizonOf(utc, place.latitude, place.longitude)(event.ra, event.dec) : null
  // Each body's face: phase, which way its north is, Saturn's rings, Jupiter's moons (lib/sky.ts)
  const faces = useMemo(() => bodyFaces(flatUtc, place.latitude, place.longitude), [flatUtc, place.latitude, place.longitude])
  /** Which way (degrees, on the map) a point lies from a body */
  const turnTo = (b: SkyBody, p: { az: number; alt: number }) => {
    const [x0, y0] = at(b.az, b.alt)
    const [x1, y1] = at(p.az, p.alt)
    return (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI
  }
  /** Which way (degrees, on the map) the Sun lies from the Moon (or a planet): its lit side faces that way */
  const moonTurn = (moon: SkyBody) => {
    const [x0, y0] = at(moon.az, moon.alt)
    const step = towards(moon, sky.bodies[0], 0.5)
    const [x1, y1] = at(step.az, step.alt)
    return (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI
  }
  const light = below ? 'below' : sky.light
  // The deep-sky objects drawn: more of the fainter ones as the map zooms in; none by day but the chosen one
  const dsoLimit = 5 + 2.2 * (view.z - 1)
  const shownDsos =
    showDso && light !== 'day'
      ? dsos.filter((d) => d.m.mag <= dsoLimit || `dso${d.m.n}` === chosen)
      : pickDso
        ? [pickDso]
        : []
  // Named where there is room: a brighter one's name keeps the ones close by from being written over it
  const dsoNamed = new Set<number>()
  {
    const placed: [number, number][] = []
    for (const d of [...shownDsos].sort((a, b) => a.m.mag - b.m.mag)) {
      if (!(view.z >= 1.8 || d.m.mag <= 4.6)) continue
      const [x, y] = at(d.az, d.alt)
      if (placed.some(([px, py]) => Math.abs(px - x) < 40 * k && Math.abs(py - y) < 10 * k)) continue
      placed.push([x, y])
      dsoNamed.add(d.m.n)
    }
  }
  const { milkyWay, deepSky } = useSkyBackdrop(flatUtc, place.latitude, place.longitude, below, view.z, smooth, dragging || moving)
  // Figure outlines: their path data once per sky; the layer again only when the choice changes.
  // Keyed by the figure (and which part of it: Serpens comes in two with the same id), not by its
  // place in the list, which shifts as figures rise and set: a remount would draw the chosen one in again
  const figureShapes = useMemo(() => {
    const parts = new Map<string, number>()
    return figureViews.map((c) => {
      const part = parts.get(c.id) ?? 0
      parts.set(c.id, part + 1)
      return { c, part, d: c.lines.map((l) => pathData(l, at)).join('') }
    })
    // at follows below
  }, [figureViews, below])
  const figuresLayer = useMemo(
    () =>
      figureShapes.length > 0 && (
        <g key={figures} className={`sky-figures sky-figures-${figures}${pickFigure ? ' has-chosen' : ''}`} aria-hidden="true">
          {figureShapes.map(({ c, part, d }) => {
            const on = chosen === `fig${c.id}`
            return (
              <g
                key={`${c.id}-${part}`}
                className={`sky-figure${on ? ' on' : ''}${figures === 'mansions' ? ` zone-${zoneOf(c.name)}` : ''}`}
                data-sound={figures === 'west' ? (on ? 'unpick' : 'sparkle') : on ? 'gongLow' : 'zhi'}
                data-tip={figureTip(c)}
                onClick={(e) => {
                  e.stopPropagation()
                  choose(`fig${c.id}`)
                }}
              >
                <path className="hit" d={d} />
                {/* The chosen one's lines draw themselves in: one length unit for the whole figure */}
                <path className="line" d={d} pathLength={1} />
              </g>
            )
          })}
        </g>
      ),
    // figureTip and choose follow the settings and setChosen
    [figureShapes, figures, chosen, pickFigure, language, script],
  )
  // Sunlight low in the sky: at dusk and dawn a warm glow on the Sun's side of the horizon, by day a
  // bright one round the Sun; and moonlight round the Moon
  const sun = sky.bodies[0]
  const sunGlow =
    below || sun.alt < -18
      ? null
      : { at: at(sun.az, Math.max(0, sun.alt)), day: sun.alt >= 0, strength: sun.alt >= 0 ? 0.75 : 0.7 * ((sun.alt + 18) / 18) ** 1.5 }
  const moon = sky.bodies[1]
  const moonGlow = !below && moon.alt > 0 && sky.light !== 'day' ? { at: at(moon.az, moon.alt), strength: 0.22 * moon.lit } : null
  // The brightest stars twinkle: drawn over the map (screen pixels), where the compositor animates them
  const twinkles =
    domeOn || below || sky.light === 'day' || !frame || smooth
      ? []
      : sky.stars
          .filter((st) => st.mag < 1.6 && st.alt > 6)
          .map((st) => {
            const [x, y] = at(st.az, st.alt)
            return { hip: st.hip, x: centre[0] + (x - C) * scale, y: centre[1] + (y - C) * scale, size: 14 + (1.6 - st.mag) * 7, colour: starColour(st.bv) }
          })
  // The stars without a name, which are only looked at, go to the canvas (skyPaint) with the faint ones
  const plainStars = useMemo(() => (domeOn ? [] : sky.stars.filter((st) => !st.name)), [sky, domeOn])
  const labels = useMemo(
    () =>
      domeOn ? [] : placeLabels([
        ...sky.bodies
          .filter((b) => shown(b.alt))
          .sort((a, b) => a.mag - b.mag)
          .map((b) => {
            const [x, y] = at(b.az, b.alt)
            return { key: b.key, text: t(b.name), x, y, r: bodySize(b), kind: 'body' as const }
          }),
        ...sky.stars
          .filter((st) => st.name)
          .map((st) => {
            const [x, y] = at(st.az, st.alt)
            return { key: `hip${st.hip}`, text: t(st.name!), x, y, r: starRadius(st.mag) * dot, kind: 'star' as const }
          }),
        // The best-known figures (rank 1–2) are named, where there is room
        ...figureViews
          .filter((c) => c.rank <= 2 && `fig${c.id}` !== chosen && (below ? c.label.alt < -3 : c.label.alt > 3))
          .map((c) => {
            const [x, y] = at(c.label.az, c.label.alt)
            return { key: `fig${c.id}`, text: figureName(c), x, y, r: 0, kind: 'figure' as const }
          }),
      ], k),
    // t is new each render but changes only with the settings
    [sky, figureViews, language, script, below, k, dot, pickFigure?.id, domeOn],
  )


  // Hover: a name tag over a body or named star, and a readout of where the pointer points, with
  // a faint altitude circle and azimuth line through it. Written straight into the page as the
  // pointer moves, without re-rendering the map.
  const svgRef = useRef<SVGSVGElement>(null)
  const mapRef = useRef<SVGGElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const readoutRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<SVGGElement>(null)
  const showTip = (target: EventTarget | null) => {
    const tip = tipRef.current
    if (!tip) return
    const el = target instanceof Element ? target.closest('[data-tip]') : null
    if (!el || drag.current?.moved) return tip.classList.remove('on')
    const r = el.getBoundingClientRect()
    const box = tip.parentElement!.getBoundingClientRect()
    tip.textContent = el.getAttribute('data-tip')
    tip.style.transform = `translate(${(r.left + r.width / 2 - box.left).toFixed(1)}px, ${(r.top - box.top).toFixed(1)}px)`
    tip.classList.add('on')
  }
  const pointAt = (e: { clientX: number; clientY: number } | null) => {
    const readout = readoutRef.current
    const cursor = cursorRef.current
    if (!readout || !cursor) return
    const m = e && mapRef.current?.getScreenCTM()
    const p = e && m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : null
    const r = p ? Math.hypot(p.x - C, p.y - C) : Infinity
    if (!p || r > R) {
      readout.classList.remove('on')
      cursor.classList.remove('on')
      return
    }
    let az = ((Math.atan2(C - p.x, C - p.y) * 180) / Math.PI + 360) % 360
    let alt = 90 * (1 - r / R)
    if (below) {
      az = (360 - az) % 360
      alt = -alt
    }
    readout.textContent = t('指向 {direction} · 高 {altitude}°', { direction: azimuth(az), altitude: alt.toFixed(0) })
    readout.classList.add('on')
    const [circle, line] = cursor.children
    circle.setAttribute('r', r.toFixed(1))
    line.setAttribute('x2', (C + ((p.x - C) * R) / (r || 1)).toFixed(1))
    line.setAttribute('y2', (C + ((p.y - C) * R) / (r || 1)).toFixed(1))
    cursor.classList.add('on')
  }

  // One pointer drags: at full size it turns the time (sideways), zoomed in it moves the map. Two
  // pinch to zoom. A press that does not move is a click. The wheel zooms, except that rolling down
  // at full size scrolls the page on to the footer, and rolling up scrolls it back first.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef<{ id: number; x: number; y: number; base: number; view: typeof view; time: boolean; moved: boolean; hour?: number } | null>(null)
  const pinch = useRef<{ dist: number; mid: [number, number]; view: typeof view } | null>(null)
  const dragged = useRef(false)
  const dragFrame = useRef(0)
  const later = (step: () => void) => {
    cancelAnimationFrame(dragFrame.current)
    dragFrame.current = requestAnimationFrame(step)
  }
  const pinchOf = () => {
    const [a, b] = [...pointers.current.values()]
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: [(a.x + b.x) / 2, (a.y + b.y) / 2] as [number, number] }
  }
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Pointing the phone is what moves the map then; a tap still picks
    if (pointingOn) return
    // The middle button turns the time at any zoom (and is kept from starting the browser's autoscroll)
    const middle = e.pointerType === 'mouse' && e.button === 1
    if (middle) e.preventDefault()
    else if (e.pointerType === 'mouse' && e.button !== 0) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      // A second finger: the drag becomes a pinch
      if (drag.current?.moved) dragged.current = true
      drag.current = null
      pinch.current = { ...pinchOf(), view: current() }
      return
    }
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, base: utc.getTime(), view: current(), time: middle || current().z <= Z_MIN, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const p = pinch.current
    if (p && pointers.current.size === 2) {
      const now = pinchOf()
      const f = frameRef.current
      if (!f) return
      later(() => {
        // Zoom about where the pinch began, then follow the fingers' midpoint; drawn when they rest or lift
        const z = Math.min(Z_MAX, Math.max(Z_MIN, (p.view.z * now.dist) / p.dist))
        const wx = f.left + f.width / 2
        const wy = f.top + f.height / 2
        const grow = z / p.view.z
        preview(
          clampView({
            z,
            x: p.mid[0] - (p.mid[0] - (wx + p.view.x)) * grow - wx + (now.mid[0] - p.mid[0]),
            y: p.mid[1] - (p.mid[1] - (wy + p.view.y)) * grow - wy + (now.mid[1] - p.mid[1]),
          }),
          250,
        )
      })
      return
    }
    const d = drag.current
    if (!d || d.id !== e.pointerId) {
      if (e.pointerType === 'mouse' && !live.current) pointAt(e)
      return
    }
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved) {
      if (Math.hypot(d.time ? dx : dx, d.time ? 0 : dy) < 6) return
      d.moved = true
      try {
        svgRef.current?.setPointerCapture(e.pointerId)
      } catch {
        // not a live pointer (a made-up event): the drag still works while it stays on the map
      }
      tipRef.current?.classList.remove('on')
      pointAt(null)
      // Taking the time or the map in hand stops it running, or following the chosen one
      if (d.time) setSpeed(0)
      else setTracking(false)
    }
    if (d.time) {
      const minutes = Math.round((dx / scale) * DRAG_MINUTES)
      const hour = Math.floor((d.base + minutes * 60_000) / HOUR)
      if (d.hour !== undefined && hour !== d.hour) play('tick')
      d.hour = hour
      later(() => {
        setDragShift(minutes)
        setPicked(wallTime(new Date(d.base + minutes * 60_000), place.timeZone))
      })
    } else later(() => preview(clampView({ ...d.view, x: d.view.x + dx, y: d.view.y + dy }), 250))
  }
  /** A gesture over: draw the view it reached now, after its last step lands */
  const settleNow = () =>
    requestAnimationFrame(() => {
      clearTimeout(settle.current)
      if (live.current) setView(live.current)
    })
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    if (pinch.current) {
      if (pointers.current.size < 2) {
        pinch.current = null
        dragged.current = true
        settleNow()
      }
      return
    }
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (!d.moved) return
    dragged.current = true
    if (!d.time) settleNow()
    // After the last step has landed
    if (d.time) requestAnimationFrame(() => requestAnimationFrame(() => setDragShift(null)))
  }
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      const zoomIn = e.deltaY < 0
      // A trackpad pinch comes as the wheel with ctrl held: always a zoom
      if (!e.ctrlKey && (zoomIn ? window.scrollY > 0 : current().z <= Z_MIN)) return
      e.preventDefault()
      const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY
      zoomAt(e.clientX, e.clientY, Math.exp(-step * (e.ctrlKey ? 0.01 : 0.0015)))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
    // zoomAt uses refs, setView and the transform only
  }, [])
  /** How fast the time runs: "10 分钟/秒", "−1 小时/秒" */
  const rateLabel = (v: number) =>
    (v < 0 ? '−' : '') +
    (Math.abs(v) >= 60 ? t('{n} 小时/秒', { n: Math.abs(v) / 60 }) : t('{n} 分钟/秒', { n: Math.abs(v) }))
  const shiftLabel = (minutes: number) => {
    const h = Math.floor(Math.abs(minutes) / 60)
    const m = Math.abs(minutes) % 60
    const span = h && m ? t('{h} 小时 {m} 分', { h, m }) : h ? t('{h} 小时', { h }) : t('{m} 分', { m })
    return `${minutes < 0 ? '−' : '+'}${span}`
  }

  // Coming in: the sky fades up from the dark, settles from a little closer, and the figures draw in
  const [entering, setEntering] = useState(() => !reducedMotion())
  useEffect(() => {
    const id = setTimeout(() => setEntering(false), 3200)
    return () => clearTimeout(id)
  }, [])
  // Now and then, at night, a shooting star somewhere high in the sky (animated by the compositor)
  const meteorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (below || sky.light === 'day' || smooth || reducedMotion()) return
    let timer = 0
    const fire = () => {
      const el = meteorRef.current
      const f = frameRef.current
      if (el && f && el.animate && !document.hidden && !drag.current?.moved && !live.current) {
        const v = viewRef.current
        const s = (Math.min(f.width, f.height) / (2 * C)) * v.z
        const turn = Math.random() * Math.PI * 2
        const off = Math.random() * 0.55 * R * s
        el.style.left = `${f.left + f.width / 2 + v.x + Math.cos(turn) * off}px`
        el.style.top = `${f.top + f.height / 2 + v.y + Math.sin(turn) * off}px`
        const dir = 25 + Math.random() * 130
        const run = 90 + Math.random() * 140
        el.animate(
          [
            { transform: `rotate(${dir}deg) translateX(0) scaleX(0.15)`, opacity: 0 },
            { opacity: 1, offset: 0.2 },
            { transform: `rotate(${dir}deg) translateX(${run}px) scaleX(1)`, opacity: 0 },
          ],
          { duration: 650 + Math.random() * 550, easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)' },
        )
      }
      timer = window.setTimeout(fire, 7000 + Math.random() * 9000)
    }
    timer = window.setTimeout(fire, 2500 + Math.random() * 3000)
    return () => clearTimeout(timer)
  }, [below, sky.light, smooth])

  const lightNote = sky.light === 'day' ? t('太阳在地平线上，白天肉眼看不到星星，图中淡淡示意它们的位置。') : sky.light === 'twilight' ? t('晨昏蒙影中，只有最亮的星和行星可见。') : ''
  // The layers start `over` before the screen's top left corner
  const mapTransform = `translate(${(centre[0] + over - C * scale).toFixed(2)} ${(centre[1] + over - C * scale).toFixed(2)}) scale(${scale.toFixed(5)})`
  const mapClass = `sky-${below ? 'below' : sky.light}${entering ? ' entering' : ''}`
  const mapStyle = { '--k': k, transformOrigin: `${centre[0] + over}px ${centre[1] + over}px` } as CSSProperties
  // The canvas between the sky and the map (skyPaint): the Milky Way and the stars without a name.
  // How much of them shows: the Milky Way is gone by day and faint in twilight, when only the
  // brighter stars are out; a bright Moon up washes out the faintest stars and the Milky Way a little.
  const moonLight = !below && moon.alt > 0 ? moon.lit : 0
  /** How dark the place is (光污染) */
  const dark = BORTLE[bortle - 1]
  // The clouds at the moment shown, if the forecast is on and reaches it; they hide what is behind them
  const cloudNow = weatherOn && !below ? weatherAt(weather.hours, utc.getTime()) : null
  const cover = cloudNow ? cloudNow.cloud / 100 : 0
  // The glow low round the sky: at night, more and more orange the brighter the towns about (光污染)
  const townGlow = light === 'night' ? Math.max(0, (bortle - 2) / 7) : 0
  const glowColour = townGlow > 0.3 ? '#8d7867' : HORIZON_GLOW[light][0]
  const glowStrength = Math.min(0.6, HORIZON_GLOW[light][1] + 0.35 * townGlow)
  const canvasLight =
    light === 'below'
      ? { milkyWay: 0.7, stars: 0.85, limit: 6.3 }
      : light === 'day'
        ? { milkyWay: 0, stars: 0.35, limit: 5 }
        : light === 'twilight'
          ? { milkyWay: 0.3, stars: 0.7, limit: 4 }
          : {
              milkyWay: dark.milkyWay * (1 - 0.3 * moonLight),
              stars: 1,
              limit: Math.min(dark.limit, 6.3 - 0.7 * moonLight),
            }
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glowRef = useRef<HTMLCanvasElement>(null)
  const cloudsRef = useRef<HTMLCanvasElement>(null)
  const paint = useRef(() => {})
  paint.current = () => {
    const el = canvasRef.current
    if (!el || !glowRef.current || !frame) return
    paintSky(el, glowRef.current, {
      width: el.clientWidth,
      height: el.clientHeight,
      ox: centre[0] + over - C * scale,
      oy: centre[1] + over - C * scale,
      scale,
      zoom: view.z,
      fit,
      below,
      band: milkyWay,
      cloud: deepSky?.cloud ?? null,
      stars: plainStars,
      faint: deepSky?.faint ?? null,
      field: deepSky?.field ?? null,
      light: canvasLight,
      rough: dragging || moving || smooth,
      lowRes: smooth,
    })
    if (cloudsRef.current)
      paintClouds(
        cloudsRef.current,
        cloudNow && cover > 0.02
          ? {
              width: el.clientWidth,
              height: el.clientHeight,
              ox: centre[0] + over - C * scale,
              oy: centre[1] + over - C * scale,
              scale,
              below,
              cover,
              low: cloudNow.low / Math.max(1, cloudNow.cloud),
              wind: cloudNow.wind,
              windFrom: cloudNow.windFrom,
              time: utc.getTime(),
              light: light === 'day' ? 'day' : light === 'twilight' ? 'twilight' : 'night',
              moon: moonLight,
              town: Math.max(0, (bortle - 3) / 6),
            }
          : null,
      )
  }
  // centre, scale and fit follow frame and view; canvasLight follows light and the Moon
  useLayoutEffect(
    () => paint.current(),
    [milkyWay, deepSky, plainStars, frame, view, below, light, moonLight, dragging, moving, smooth, bortle, cloudNow?.time, cover],
  )
  // The canvas fills the screen: drawn again when the screen's size changes (a phone's address bar
  // folding away), which need not move the sky's window
  useEffect(() => {
    const el = canvasRef.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(() => paint.current())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // The sky itself (its colour, glows and the Milky Way, with its blurs) in an SVG of its own, on a
  // layer of its own, under the map: it changes only as the time, place or view does, so choosing,
  // hovering and the fades that follow repaint the map above without blurring the Milky Way again
  // (zoomed in, that took long enough to make the page flicker)
  // The flat map's two layers are built only while it shows: under the dome view they would be
  // thousands of elements made on every step of the time and thrown away
  const backdrop = !domeOn && (
    <svg className={`sky-map-back ${mapClass}`} style={mapStyle} aria-hidden="true">
      <g transform={mapTransform}>
      <defs>
        <clipPath id={clipId}>
          <circle cx={C} cy={C} r={R} />
        </clipPath>
        <radialGradient id={`${clipId}-sky`} cx={C} cy={C} r={R} gradientUnits="userSpaceOnUse">
          {SKY_STOPS[light].map(([offset, colour]) => (
            <stop key={offset} offset={offset} stopColor={colour} />
          ))}
        </radialGradient>
        <radialGradient id={`${clipId}-air`} cx={C} cy={C} r={R} gradientUnits="userSpaceOnUse">
          <stop offset={townGlow ? 0.2 : 0.5} stopColor={glowColour} stopOpacity={townGlow * 0.1} />
          <stop offset={0.86} stopColor={glowColour} stopOpacity={glowStrength * 0.45} />
          <stop offset={1} stopColor={glowColour} stopOpacity={glowStrength} />
        </radialGradient>
        <radialGradient id={`${clipId}-ground`} cx={C} cy={C} r={4 * R} gradientUnits="userSpaceOnUse">
          <stop offset={0.25} stopColor="#0a0f1d" />
          <stop offset={0.42} stopColor="#05070f" />
          <stop offset={1} stopColor="#020308" />
        </radialGradient>
        <radialGradient id={`${clipId}-dusk`}>
          <stop offset={0} stopColor="#ffa766" stopOpacity={0.75} />
          <stop offset={0.45} stopColor="#e46e5a" stopOpacity={0.28} />
          <stop offset={1} stopColor="#7a4a8a" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${clipId}-noon`}>
          <stop offset={0} stopColor="#fffbea" stopOpacity={0.75} />
          <stop offset={0.25} stopColor="#fff3c4" stopOpacity={0.28} />
          <stop offset={1} stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${clipId}-moon`}>
          <stop offset={0} stopColor="#e4ebff" stopOpacity={1} />
          <stop offset={1} stopColor="#e4ebff" stopOpacity={0} />
        </radialGradient>
        {/* A named star's light, in each of the stars' colours (as skyPaint draws the rest) */}
        {PALETTE.map((hex, i) => (
          <radialGradient key={hex} id={`${clipId}-star-${i}`}>
            {PSF.map(([offset, white, alpha]) => (
              <stop key={offset} offset={offset} stopColor={white ? mixWhite(hex, white) : hex} stopOpacity={alpha} />
            ))}
          </radialGradient>
        ))}
        {/* A planet's point of light, in its colour */}
        {Object.entries(BODY_COLOUR).map(([key, hex]) => (
          <radialGradient key={key} id={`${clipId}-pglow-${key}`}>
            {PSF.map(([offset, white, alpha]) => (
              <stop key={offset} offset={offset} stopColor={white ? mixWhite(hex, white) : hex} stopOpacity={alpha} />
            ))}
          </radialGradient>
        ))}
        <SkyFaceDefs id={clipId} />
        <radialGradient id={`${clipId}-fuzz`}>
          <stop offset={0} stopColor="#e8ecff" stopOpacity={0.9} />
          <stop offset={0.4} stopColor="#c8d2f0" stopOpacity={0.35} />
          <stop offset={1} stopColor="#c8d2f0" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${clipId}-halo`}>
          <stop offset={0} stopColor="#ffffff" stopOpacity={0.55} />
          <stop offset={0.35} stopColor="#ffffff" stopOpacity={0.12} />
          <stop offset={1} stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* The sky: darkest overhead, lighter and glowing towards the horizon */}
      <circle className="sky-disc" cx={C} cy={C} r={R} fill={`url(#${clipId}-sky)`} />
      <circle className="sky-airglow" cx={C} cy={C} r={R} fill={`url(#${clipId}-air)`} />
      <g clipPath={`url(#${clipId})`} className="sky-light" aria-hidden="true">
        {sunGlow && (
          <circle
            cx={sunGlow.at[0]}
            cy={sunGlow.at[1]}
            r={sunGlow.day ? R * 0.75 : R * 1.05}
            fill={`url(#${clipId}-${sunGlow.day ? 'noon' : 'dusk'})`}
            opacity={sunGlow.strength}
          />
        )}
        {moonGlow && <circle cx={moonGlow.at[0]} cy={moonGlow.at[1]} r={R * 0.42} fill={`url(#${clipId}-moon)`} opacity={moonGlow.strength} />}
      </g>
      </g>
    </svg>
  )
  const map = !domeOn && (
    <svg
      ref={svgRef}
      className={`sky-map ${mapClass}${spot ? ' has-chosen' : ''}${pickFigure ? ' figure-chosen' : ''}${figuresSwitched ? ' figures-switched' : ''}${view.z > Z_MIN ? ' zoomed' : ''}`}
      style={mapStyle}
      // A group rather than an image, so the bodies and named stars can be chosen from the keyboard
      role="group"
      aria-label={t('此刻天空星图')}
      onClick={() => {
        // The end of a drag is not a click on the empty sky
        if (dragged.current) dragged.current = false
        else setChosen(null)
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      // Not while a zoom or drag moves the map under a still pointer: each would measure the page anew
      onPointerOver={(e) => e.pointerType === 'mouse' && !live.current && showTip(e.target)}
      onPointerLeave={() => {
        pointAt(null)
        tipRef.current?.classList.remove('on')
      }}
    >
      <g ref={mapRef} transform={mapTransform}>
      <g clipPath={`url(#${clipId})`}>
        {[30, 60].map((alt) => (
          <circle key={alt} className="sky-grid" cx={C} cy={C} r={(R * (90 - alt)) / 90} />
        ))}
        <line className="sky-grid" x1={C} y1={C - R} x2={C} y2={C + R} />
        <line className="sky-grid" x1={C - R} y1={C} x2={C + R} y2={C} />
        {/* Where the pointer points: its altitude circle and azimuth line (set by pointAt) */}
        <g className="sky-cursor" ref={cursorRef} aria-hidden="true">
          <circle cx={C} cy={C} />
          <line x1={C} y1={C} />
        </g>
        {mansionView && (
          <g className="sky-mansions" aria-hidden="true">
            <path className="equator" d={pathData(mansionView.equator, at)} />
            {mansionView.bounds.map((b, i) => (
              <path key={i} className={`bound zone-${MANSIONS[i].zone}`} d={pathData(b, at)} />
            ))}
            {mansionView.middles.map((p, i) => {
              if (!shown(p.alt)) return null
              const [x, y] = at(p.az, p.alt)
              return (
                <text key={i} className={`mansion-char zone-${MANSIONS[i].zone}`} x={x} y={y} textAnchor="middle" dominantBaseline="central">
                  {mansionName(MANSIONS[i].name).slice(0, 1)}
                </text>
              )
            })}
          </g>
        )}
        {grid && (
          <g className="sky-eqgrid" aria-hidden="true">
            {eqGrid && (
              <>
                {grid.decs.map((d) => (
                  <path key={`d${d.dec}`} className={d.dec === 0 ? 'equator' : undefined} d={pathData(d.pts, at)} />
                ))}
                {grid.hours.map((h) => (
                  <path key={`h${h.hour}`} d={pathData(h.pts, at)} />
                ))}
                {grid.hours
                  .filter((h) => shown(h.label.alt))
                  .map((h) => {
                    const [x, y] = at(h.label.az, h.label.alt)
                    return (
                      <text key={`l${h.hour}`} x={x + 3 * k} y={y - 3 * k}>
                        {h.hour}h
                      </text>
                    )
                  })}
              </>
            )}
            {showEcliptic && (
              <g className="ecliptic">
                <path d={pathData(grid.ecliptic, at)} />
                {grid.signs
                  .filter((p) => shown(p.alt))
                  .map((p) => {
                    const [x, y] = at(p.az, p.alt)
                    return <circle key={p.lon} cx={x} cy={y} r={1.6 * dot} />
                  })}
              </g>
            )}
          </g>
        )}
        {figuresLayer}
        {shownDsos.length > 0 && (
          <g className="sky-dsos">
            {shownDsos.map(({ m, az, alt, axis }) => {
              const key = `dso${m.n}`
              const [x, y] = at(az, alt)
              // Its long axis turned as it lies on the sky here (its position angle from the north)
              const [ax, ay] = axis ? at(axis.az, axis.alt) : [x + 1, y]
              const turn = `rotate(${((Math.atan2(ay - y, ax - x) * 180) / Math.PI).toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})`
              const r = dsoMark(m)
              const tip = t('{name} · {direction} · 高 {altitude}°', {
                name: `${messierName(m, en)} · ${t(KIND_NAME[m.kind])}`,
                direction: azimuth(az),
                altitude: alt.toFixed(1),
              })
              const named = view.z >= 3 && (en ? m.en : m.zh)
              return (
                <g
                  key={key}
                  className={`sky-dso sky-dso-${m.kind}${chosen === key ? ' on' : ''}${focus === key ? ' hover' : ''}`}
                  style={{ color: DSO_COLOUR[m.kind] }}
                  aria-label={tip}
                  data-tip={tip}
                  {...chooseProps(key)}
                  {...focusProps(key)}
                >
                  <circle className="hit" cx={x} cy={y} r={Math.max(r + 3 * k, 9 * k)} />
                  {m.kind !== 'oc' && m.kind !== 'asterism' && (
                    <ellipse
                      className="fuzz"
                      cx={x}
                      cy={y}
                      rx={dsoRadius(m) * 1.15 + 1.2 * dot}
                      ry={(dsoRadius(m) * Math.max(0.45, m.size[1] / m.size[0])) * 1.15 + 1.2 * dot}
                      fill={`url(#${clipId}-fuzz)`}
                      transform={turn}
                      opacity={Math.min(0.55, Math.max(0.12, (11 - m.mag) / 12))}
                    />
                  )}
                  <g transform={m.kind === 'galaxy' ? turn : undefined}>
                    <DsoMark m={m} x={x} y={y} r={r} />
                  </g>
                  {dsoNamed.has(m.n) && (
                    <text className="sky-dso-name" x={x + r + 3 * k} y={y} dominantBaseline="central">
                      {named ? `M${m.n} ${named}` : `M${m.n}`}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        )}
        <g className="sky-halos" aria-hidden="true">
          {up
            .filter((b) => b.key === 'moon')
            .map((b) => {
              const [x, y] = at(b.az, b.alt)
              const r = discOf(b) * 4.5
              return <circle key={b.key} cx={x} cy={y} r={r} fill={`url(#${clipId}-halo)`} opacity={b.key === 'moon' ? 0.4 + 0.5 * b.lit : 0.55} />
            })}
        </g>
        <g className="sky-stars">
          {sky.stars.filter((s) => s.name).map((s) => (
            <Star
              key={s.hip}
              star={s}
              tip={s.name && t('{name} · {direction} · 高 {altitude}°', { name: t(s.name), direction: azimuth(s.az), altitude: s.alt.toFixed(1) })}
              at={at}
              size={dot}
              light={`url(#${clipId}-star-${colourIndex(s.bv)})`}
              seen={Math.min(1, Math.max(0.12, (canvasLight.limit - s.mag) / 0.8))}
              hit={10 * k}
              on={chosen === `hip${s.hip}`}
              hover={focus === `hip${s.hip}`}
              chooseProps={{ ...chooseProps(`hip${s.hip}`), ...focusProps(`hip${s.hip}`) }}
            />
          ))}
        </g>
        {allPaths && (
          <g className={`sky-paths${litPaths.length ? ' has-focus' : ''}`} aria-hidden="true">
            {allPaths.map((p) => (
              <g key={p.key} className={`sky-path${litPaths.includes(p) ? ' on' : ''}${p.key === chosen && !smooth && !dragging ? ' pulsing' : ''}`} style={{ color: BODY_COLOUR[p.key] ?? colourOf(p.key) }}>
                <path className="past" d={p.past} />
                <path className="future" d={p.future} />
                {p.hours.map((h, i) => {
                  const [x, y] = at(h.az, h.alt)
                  // a 24-hour window has one hour twice
                  return <circle key={i} className="hour" cx={x} cy={y} r={1.6 * dot} />
                })}
              </g>
            ))}
          </g>
        )}
        {historyLine && (
          <>
            <g className={`sky-history${!smooth && !dragging ? ' pulsing' : ''}`} style={{ color: BODY_COLOUR[historyLine.key] }} aria-hidden="true">
              <path d={historyLine.d} />
              {historyLine.ticks.map((p) => {
                const [x, y] = at(p.az, p.alt)
                return <circle key={`${p.m}-${p.d}`} className="tick" cx={x} cy={y} r={1.8 * dot} />
              })}
              <circle className="start" cx={at(historyLine.start.az, historyLine.start.alt)[0]} cy={at(historyLine.start.az, historyLine.start.alt)[1]} r={3 * dot} />
            </g>
            <g className="sky-history-labels" aria-hidden="true">
              {historyLine.ticks
                .filter((p) => (below ? p.alt < 0 : p.alt > 0))
                .map((p) => {
                  const [x, y] = at(p.az, p.alt)
                  return (
                    <text key={`${p.m}-${p.d}`} x={x + 5 * k} y={y + 4 * k}>
                      {dateLabel(p.m, p.d)}
                    </text>
                  )
                })}
            </g>
          </>
        )}
        <g className="sky-bodies">
          {/* The Moon last: nearer than any planet, it passes in front of them */}
          {[...up.filter((b) => b.key !== 'moon'), ...up.filter((b) => b.key === 'moon')].map((b) => {
            const [x, y] = at(b.az, b.alt)
            const tip = t('{name} · {direction} · 高 {altitude}°', { name: t(b.name), direction: azimuth(b.az), altitude: b.alt.toFixed(1) })
            return (
              <g
                key={b.key}
                className={`sky-body sky-${b.key}${chosen === b.key || (event && moment?.also === b.key) ? ' on' : ''}${focus === b.key ? ' hover' : ''}`}
                aria-label={tip}
                data-tip={tip}
                {...chooseProps(b.key)}
                {...focusProps(b.key)}
              >
                <circle className="hit" cx={x} cy={y} r={Math.max(bodySize(b) + 4 * k, 12 * k)} />
                {/* As it looks: the Moon's face lit towards the Sun, a planet's point of light or, zoomed in,
                    its face, each turned upright to its own north as it stands in the sky here */}
                {globeOf(b) ? null : (
                <BodyFaceView
                  kind={b.key}
                  x={x}
                  y={y}
                  r={discOf(b)}
                  close={faceSize(b.key) >= 4}
                  glow={Math.max(glowRadius(b.mag), 2.6) * dot}
                  glowFill={`url(#${clipId}-pglow-${b.key})`}
                  colour={BODY_COLOUR[b.key]}
                  face={faces[b.key]}
                  north={faces[b.key] ? turnTo(b, faces[b.key]!.north) : -90}
                  sun={moonTurn(b)}
                  moonTurns={faces[b.key]?.moons?.map((m) => turnTo(b, m.toward))}
                  id={clipId}
                />
                )}
                {shade?.body === b.key && (
                  // The eclipse, over the body: the Earth's shadow on the Moon, the Moon on the Sun
                  <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} className={`sky-eclipse sky-eclipse-${b.key}${shade.dim ? ' dim' : ''}`}>
                    <clipPath id={`${clipId}-eclipse`}>
                      <circle r={discOf(b)} />
                    </clipPath>
                    {/* A disc too, to grow with the body when it is chosen */}
                    <g className="disc">
                      <circle
                        clipPath={`url(#${clipId}-eclipse)`}
                        cx={0.8 * shade.offset * discOf(b)}
                        cy={-0.6 * shade.offset * discOf(b)}
                        r={shade.radius * discOf(b)}
                      />
                    </g>
                  </g>
                )}
              </g>
            )
          })}
        </g>
        {radiant && radiant.alt > 0 && (
          // A shower's radiant, and meteors running out from it
          <g className="sky-radiant" transform={`translate(${at(radiant.az, radiant.alt).map((n) => n.toFixed(2)).join(' ')})`} aria-hidden="true">
            <circle r={5 * k} />
            {RADIANT_TRAILS.map(([turn, delay, far]) => (
              <g key={turn} transform={`rotate(${turn})`}>
                <line
                  x1={(10 + far) * k}
                  x2={(10 + far + 34) * k}
                  style={{ animationDelay: `${delay}s`, '--run': `${70 * k}px` } as CSSProperties}
                />
              </g>
            ))}
            <text y={-9 * k}>{t('辐射点')}</text>
          </g>
        )}
        {litPaths.length > 0 && (
          <g className="sky-hour-labels" aria-hidden="true">
            {litPaths.map((path) => {
              const here = whereNow(path.key)
              return path.hours.map((h, i) => {
                const [x, y] = at(h.az, h.alt)
                // None right on the body, where its name is
                if (here && Math.hypot(x - here[0], y - here[1]) < 24 * k) return null
                return (
                  <text key={`${path.key}-${i}`} x={x + 5 * k} y={y - 5 * k}>
                    {t('{h}时', { h: h.hour })}
                  </text>
                )
              })
            })}
          </g>
        )}
      </g>
      {/* The ground and the skyline round the horizon, with the azimuths marked just outside it */}
      <path className="sky-ground" d={below ? GROUND : SKYLINE} fill={`url(#${clipId}-ground)`} fillRule="evenodd" aria-hidden="true" />
      <path className="sky-ticks" d={TICKS} aria-hidden="true" />
      {(
        [
          ['北', 'N', 0],
          ['东', 'E', 90],
          ['南', 'S', 180],
          ['西', 'W', 270],
        ] as const
      ).map(([label, labelEn, az]) => {
        const [x, y] = project(below ? (360 - az) % 360 : az, -12)
        return (
          <text key={label} className="sky-compass" x={x} y={y} textAnchor="middle" dominantBaseline="central">
            {en ? labelEn : label}
          </text>
        )
      })}
      <g>
        <g className="sky-labels" aria-hidden="true">
          {labels.map((l) => {
            // The chosen one's name moves out past its ring
            const push = l.key === chosen && spot ? pickRadius! * 0.4 + 6 * k : 0
            return (
              <text
                key={l.key}
                className={
                  (l.kind === 'body'
                    ? 'sky-body-name'
                    : l.kind === 'figure'
                      ? `sky-figure-name sky-figure-name-${figures}${figures === 'mansions' ? ` zone-${zoneOf(figureViews.find((c) => `fig${c.id}` === l.key)?.name ?? '')}` : ''}`
                      : 'sky-star-name') +
                  (l.key === chosen ? ' on' : '') +
                  (l.key === focus ? ' hover' : '')
                }
                x={l.anchor === 'start' ? l.x + push : l.anchor === 'end' ? l.x - push : l.x}
                y={l.anchor !== 'middle' || !spot ? l.y : l.y < spot[1] ? l.y - push : l.y + push}
                textAnchor={l.anchor}
                data-sound={
                  l.kind === 'figure' && figures !== 'west'
                    ? l.key === chosen
                      ? 'gongLow'
                      : 'zhi'
                    : l.key === chosen
                      ? 'unpick'
                      : l.kind === 'figure'
                        ? 'sparkle'
                        : 'pick'
                }
                dominantBaseline="central"
                onClick={(e) => {
                  e.stopPropagation()
                  choose(l.key)
                }}
              >
                {l.text}
              </text>
            )
          })}
        </g>
      </g>
      {pickFigure && (
        <text
          key={chosen}
          className={`sky-figure-name sky-figure-name-${figures} chosen${figures === 'mansions' ? ` zone-${zoneOf(pickFigure.name)}` : ''}`}
          x={at(pickFigure.label.az, pickFigure.label.alt)[0]}
          y={at(pickFigure.label.az, pickFigure.label.alt)[1]}
          textAnchor="middle"
          dominantBaseline="central"
          aria-hidden="true"
        >
          {figureName(pickFigure)}
        </text>
      )}
      {/* The ring round the chosen one: it closes in on it (keyed, so it does again for the next) and pulses */}
      {spot && (
        <g key={chosen} className="sky-chosen" style={{ color: pickColour }} aria-hidden="true">
          <circle cx={spot[0]} cy={spot[1]} r={pickRadius! * 1.4 + 6 * k} />
          <circle className="pulse" cx={spot[0]} cy={spot[1]} r={pickRadius! * 1.4 + 6 * k} />
        </g>
      )}
      </g>
    </svg>
  )

  // The notes on what the sky shows, at the foot of the settings
  const notes = (
    <p className="muted row-note">
      {t('上为北、左为东，如仰望天空。这是天体在天上的实际位置，与星盘里以黄道十二宫计的星座不同。')}
      {en && ' '}
      {below ? t('脚下：地平线以下、被地球挡住的那半边天空，像透过地球往下看；中心是天底，东西因此左右互换。') : lightNote}
      {(below || lightNote) && en && ' '}
      {below
        ? t('地平线下有 {n} 颗 5 等以内的亮星。', { n: sky.stars.length })
        : t('地平线上有 {n} 颗 5 等以内的亮星，另有 6 等以内的暗星和银河的星云，星点大小示亮度、颜色示温度；放大可看到更多更暗的星。', { n: sky.stars.length })}
      {en && ' '}
      {t('点一下天体、有名字的亮星、星座连线或表格里的一行可把它选中，看它的详细信息（开着轨迹时也画出它的轨迹），再点一次、点空白处或按 Esc 取消；左右拖动星空可以转动时间。')}
      {paths && en && ' '}
      {paths && t('彩色弧线是日月和肉眼可见的行星前后 12 小时在天上走过的路径：虚线已走过，实线将要走，圆点是整点；悬停天体或表格里的一行可看各整点。')}
      {historyLine && en && ' '}
      {historyLine &&
        t('{name}过去 {span}在星空中走过的路线（画在此刻的星空上）：空心圆是起点，圆点标出日期；行星逆行时会折返或打圈。', {
          name: t(sky.bodies.find((b) => b.key === historyLine.key)!.name),
          span: history.days === 30 ? t('1 个月') : history.days === 90 ? t('3 个月') : t('1 年'),
        })}
      {showDso && en && ' '}
      {showDso &&
        t('小符号是梅西耶深空天体：椭圆是星系，带十字的圆是球状星团，虚线圆是疏散星团，方框是星云，带刻线的小圆是行星状星云；放大可看到更暗的。')}
      {eqGrid && en && ' '}
      {eqGrid && t('赤道坐标网：实线是天赤道，纬线每 30° 一条赤纬，经线每 2 小时一条赤经。')}
      {showEcliptic && en && ' '}
      {showEcliptic && t('黄道是太阳一年在星空中走的路，日月行星都在它附近；圆点每 30° 一个，是黄道十二宫的起点。')}
      {en && ' '}
      {t('时间栏的 ▶ 让时间流动，◀◀ ▶▶ 调快慢或倒放；搜索框可以找到天体、亮星、深空天体和星座并跟踪它。')}
      {figures === 'mansions' && en && ' '}
      {figures === 'mansions' &&
        t(
          '二十八宿按四象着色：青为东方苍龙、蓝为北方玄武、白为西方白虎、红为南方朱雀。虚线是各宿距星所在的赤经线，把天赤道（点线）分成二十八段，每段的宽窄就是宿度；表格里的「宿」是日月五星此刻所在的宿。',
        )}
    </p>
  )
  // A few words on what is chosen (lib/skyIntros), under its details: a body, a named star, a
  // Western constellation, or a 星官 (the 宿, the 三垣 and the best known of the rest)
  const intro = pickFigure
    ? figures === 'west'
      ? WESTERN_INTRO[pickFigure.id]
      : CHINA_INTRO[pickFigure.name]
    : pick
      ? 'key' in pick
        ? BODY_INTRO[pick.key]
        : STAR_INTRO[pick.hip]
      : undefined
  const introText = intro && <p className="sky-intro">{en ? intro.en : intro.zh}</p>
  // Where the stars and the figures come from: a line of its own under the notes, the names linked
  const sourceLink = (href: string, text: string) => (
    <a href={href} target="_blank" rel="noreferrer">
      {text}
    </a>
  )
  const D3 = sourceLink('https://github.com/ofrohn/d3-celestial', 'd3-celestial')
  const sources = (
    <p className="muted row-note sky-sources">
      {withSlots(t('来源：星表 {d3}（{xhip}）', { d3: '{d3}', xhip: '{xhip}' }), {
        d3: D3,
        xhip: sourceLink('https://cdsarc.cds.unistra.fr/viz-bin/cat/V/137D', t('XHIP 依巴谷星表')),
      })}
      {figures === 'west' && withSlots(t('；星座连线 {d3}', { d3: '{d3}' }), { d3: D3 })}
      {showDso && withSlots(t('；梅西耶天体 {d3}', { d3: '{d3}' }), { d3: D3 })}
      {(figures === 'china' || figures === 'mansions') &&
        withSlots(t('；星官连线 {stellarium}（{licence}），经 {d3} 整理', { stellarium: '{stellarium}', licence: '{licence}', d3: '{d3}' }), {
          stellarium: sourceLink('https://github.com/Stellarium/stellarium-skycultures/tree/master/chinese', t('Stellarium 中国星空文化')),
          licence: sourceLink('https://creativecommons.org/licenses/by-sa/4.0/', 'CC BY-SA 4.0'),
          d3: D3,
        })}
    </p>
  )

  return (
    <section id="sky-now" className="sky-stage">
      {/* Above the sky: its title, and the moment and the place (地点 opens the place's details) */}
      <div className={`sky-toolbar${timeOpen ? ' time-open' : ''}`}>
        <h3 className="section-title">
          <TitleMark />
          {t('此刻天空')}
        </h3>
        <SkySearch items={searchItems} onPick={goTo} />
        {canPoint() && (
          <button type="button" className="ghost sky-point-btn" onClick={startPointing}>
            {t('对准天空')}
          </button>
        )}
        {pointing.state === 'denied' && <small className="muted">{t('没有得到使用方向传感器的许可。')}</small>}
        {pointing.state === 'nocompass' && <small className="muted">{t('这台设备没有提供指南针数据。')}</small>}
        {/* On a phone the time bar folds to one line, the moment and place shown, with play beside it;
            a tap on it unfolds the bar (CSS shows this line only on narrow screens) */}
        <div className="sky-time-fold">
          <button
            type="button"
            className="ghost sky-time-summary"
            aria-expanded={timeOpen}
            data-sound={timeOpen ? 'off' : 'on'}
            onClick={() => setTimeOpen((o) => !o)}
          >
            {t('{m}月{d}日', { m: Number(wall.date.slice(5, 7)), d: Number(wall.date.slice(8, 10)) })} {wall.time} · {t(place.name)}
            {speed !== 0 && ` · ${rateLabel(speed)}`}
            <span className="sky-fold-mark" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`ghost sky-time-play${speed ? ' on' : ''}`}
            data-sound={speed ? 'off' : 'on'}
            aria-pressed={speed !== 0}
            aria-label={speed ? t('暂停') : t('让时间流动')}
            onClick={() => setSpeed((v) => (v ? 0 : 10))}
          >
            {speed ? '❚❚' : '▶'}
          </button>
        </div>
        <div className="overlay-bar sky-controls sky-timebar">
        <DateParts
          label={t('日期')}
          value={ymd(wall.date)}
          onChange={(d) => setPicked({ ...wall, date: `${d.year}-${pad(d.month)}-${pad(d.day)}` })}
        />
        <input type="time" aria-label={t('时间')} value={wall.time} onChange={(e) => e.target.value && setPicked({ ...wall, time: e.target.value })} />
        <button
          type="button"
          className={`ghost toggle${picked ? ' sky-now-hint' : ' on'}`}
          title={picked ? t('回到现在') : undefined}
          aria-pressed={!picked}
          // Already following the clock: pressing again only refreshes it
          data-sound={picked ? 'on' : 'tap'}
          onClick={() => {
            setSpeed(0)
            setNow(new Date())
            setPicked(null)
          }}
        >
          {t('现在')}
        </button>
        <div className="sky-flow" role="group" aria-label={t('时间流动')}>
          <button type="button" className="ghost" data-sound="tick" aria-label={t('慢一点或倒放')} title={t('慢一点或倒放')} disabled={speed === SPEEDS[0]} onClick={() => changeSpeed(-1)}>
            ◀◀
          </button>
          <button
            type="button"
            className={`ghost${speed ? ' on' : ''}`}
            data-sound={speed ? 'off' : 'on'}
            aria-pressed={speed !== 0}
            aria-label={speed ? t('暂停') : t('让时间流动')}
            title={speed ? t('暂停') : t('让时间流动')}
            onClick={() => setSpeed((v) => (v ? 0 : 10))}
          >
            {speed ? '❚❚' : '▶'}
          </button>
          <button type="button" className="ghost" data-sound="tick" aria-label={t('快一点')} title={t('快一点')} disabled={speed === SPEEDS[SPEEDS.length - 1]} onClick={() => changeSpeed(1)}>
            ▶▶
          </button>
          {speed !== 0 && <span className="sky-flow-rate">{rateLabel(speed)}</span>}
        </div>
          <div className="sky-place-menu" ref={placeRef}>
            <button
              type="button"
              className={`ghost sky-place-button${placeOpen ? ' on' : ''}`}
              aria-expanded={placeOpen}
              aria-controls={`${clipId}-place`}
              data-sound={placeOpen ? 'off' : 'on'}
              onClick={() => setPlaceOpen((o) => !o)}
            >
              <span className="sky-place-label">{t('地点')}</span>
              {t(place.name)}
              <span className="sky-fold-mark" aria-hidden="true" />
            </button>
            {placeOpen && (
              <div className="card sky-place-pop" id={`${clipId}-place`}>
                {placeControls && <div className="sky-place bazi-form">{placeControls}</div>}
                <p className="muted row-note sky-when">
                  {t('{place}上空 · 当地时间 {date} {time}', { place: t(place.name), date: wall.date, time: wall.time })}
                  {picked ? '' : t('（随时间更新）')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Left empty: the sky behind the page shows through here */}
      <div className="sky-window" ref={windowRef} />

      {/* On the right, always there: the bodies, or what is chosen, in detail */}
      <aside className="sky-bodies" aria-label={t('天体')}>
        {showNight && (
        <SkyNight
          utc={utc}
          latitude={place.latitude}
          longitude={place.longitude}
          weather={weather.hours}
          weatherOn={weatherOn}
          weatherFailed={weather.failed}
          onWeather={toggleWeather}
          clock={(ms) => wallTime(new Date(ms), place.timeZone).time}
          onPick={(ms) => setPicked(wallTime(new Date(ms), place.timeZone))}
        />
        )}
        {event && (
          <div className="sky-event">
            <span className="sky-event-kind">{t('天象预告')}</span>
            <strong>{eventText.title(event)}</strong>
            <span className="sky-when">{eventText.when(event)}</span>
            <span className="muted">{eventText.note(event)}</span>
            {shade && <span className="muted">{t('日月的大小是示意的；拖动时间可看食的过程。')}</span>}
            <button type="button" className="ghost sky-unchoose" data-sound="unpick" aria-label={t('关闭')} title={t('关闭')} onClick={() => setEventClosed(true)}>
              ✕
            </button>
          </div>
        )}
        {pickFigure ? (
          <div className="sky-detail">
            <button type="button" className="ghost sky-back" data-sound="unpick" onClick={() => setChosen(null)}>
              ‹ {t('全部天体')}
            </button>
            <div className="sky-chosen-info">
              <span
                className={`sky-figure-mark sky-figure-mark-${figures}${figures === 'mansions' ? ` zone-${zoneOf(pickFigure.name)}` : ''}`}
                aria-hidden="true"
              />
              <strong>{figureName(pickFigure)}</strong>
              <span className="muted">
                {figures === 'mansions' ? (
                  <MansionFacts name={pickFigure.name} />
                ) : (
                  <>
                    {figures === 'west' ? t('西方星座') : t('中国星官')}
                    {!(figures === 'west' && en) && ` · ${pickFigure.en}`}
                  </>
                )}
              </span>
              <button type="button" className="ghost sky-unchoose" data-sound="unpick" aria-label={t('取消选中')} title={t('取消选中')} onClick={() => setChosen(null)}>
                ✕
              </button>
            </div>
            <dl className="sky-facts">
              <dt>{t('方位')}</dt>
              <dd>{azimuth(pickFigure.label.az)}</dd>
              <dt>{t('高度')}</dt>
              <dd>{`${pickFigure.label.alt.toFixed(1)}°`}</dd>
            </dl>
            {introText}
          </div>
        ) : pickDso ? (
          <div className="sky-detail">
            <button type="button" className="ghost sky-back" data-sound="unpick" onClick={() => setChosen(null)}>
              ‹ {t('全部天体')}
            </button>
            <div className="sky-chosen-info">
              <span className="sky-dot" style={{ background: pickColour }} />
              <strong>{messierName(pickDso.m, en)}</strong>
              <span className="muted">
                {[(en ? pickDso.m.en : pickDso.m.zh) && `M${pickDso.m.n}`, pickDso.m.desig, t(KIND_NAME[pickDso.m.kind])].filter(Boolean).join(' · ')}
              </span>
              <button type="button" className="ghost sky-unchoose" data-sound="unpick" aria-label={t('取消选中')} title={t('取消选中')} onClick={() => setChosen(null)}>
                ✕
              </button>
            </div>
            <dl className="sky-facts">
              <dt>{t('方位')}</dt>
              <dd>{azimuth(pickDso.az)}</dd>
              <dt>{t('高度')}</dt>
              <dd>{pickDso.alt < 0 ? `${t('地平线下')} · ${pickDso.alt.toFixed(1)}°` : `${pickDso.alt.toFixed(1)}°`}</dd>
              <dt>{t('星等')}</dt>
              <dd>{pickDso.m.mag.toFixed(1)}</dd>
              <dt>{t('视大小')}</dt>
              <dd>{pickDso.m.size[0] === pickDso.m.size[1] ? `${pickDso.m.size[0]}′` : `${pickDso.m.size[0]}′ × ${pickDso.m.size[1]}′`}</dd>
              {dsoDetails?.constellation && (
                <>
                  <dt>{t('所处星座')}</dt>
                  <dd>{en ? dsoDetails.constellation.en : script === 'trad' ? dsoDetails.constellation.trad : dsoDetails.constellation.name}</dd>
                </>
              )}
              {dsoDetails?.times &&
                ('always' in dsoDetails.times ? (
                  <>
                    <dt>{t('出没')}</dt>
                    <dd>{dsoDetails.times.always === 'up' ? t('终年不落（拱极）') : t('终年不升')}</dd>
                  </>
                ) : (
                  <>
                    <dt>{t('升起')}</dt>
                    <dd>{clock(dsoDetails.times.rise)}</dd>
                    <dt>{t('落下')}</dt>
                    <dd>{clock(dsoDetails.times.set)}</dd>
                  </>
                ))}
              {dsoDetails && (
                <>
                  <dt>{t('宿')}</dt>
                  <dd className={`sky-mansion-cell zone-${dsoDetails.mansion.zone}`}>{mansionName(dsoDetails.mansion.name)}</dd>
                </>
              )}
            </dl>
            <div className="sky-switches">
              <SkySwitch on={tracking} label={t('跟踪')} onChange={toggleTracking} />
            </div>
            {MESSIER_INTRO[pickDso.m.n] && <p className="sky-intro">{en ? MESSIER_INTRO[pickDso.m.n].en : MESSIER_INTRO[pickDso.m.n].zh}</p>}
          </div>
        ) : pick ? (
          <div className="sky-detail">
            <button type="button" className="ghost sky-back" data-sound="unpick" onClick={() => setChosen(null)}>
              ‹ {t('全部天体')}
            </button>
            <div className="sky-chosen-info">
              <span className="sky-dot" style={{ background: pickColour }} />
              <strong>{pickName}</strong>
              <span className="muted">{pickKind}</span>
              <button type="button" className="ghost sky-unchoose" data-sound="unpick" aria-label={t('取消选中')} title={t('取消选中')} onClick={() => setChosen(null)}>
                ✕
              </button>
            </div>
            <dl className="sky-facts">
              <dt>{t('方位')}</dt>
              <dd>{azimuth(pick.az)}</dd>
              <dt>{t('高度')}</dt>
              <dd>{pick.alt < 0 ? `${t('地平线下')} · ${pick.alt.toFixed(1)}°` : `${pick.alt.toFixed(1)}°`}</dd>
              <dt>{t('星等')}</dt>
              <dd>{pick.mag.toFixed(1)}</dd>
              {'phase' in pick && pick.phase !== undefined && (
                <>
                  <dt>{t('月相')}</dt>
                  <dd>
                    {t(moonPhaseName(pick.phase))} · {t('照亮 {n}%', { n: Math.round(pick.lit * 100) })}
                  </dd>
                </>
              )}
              {details?.times && (
                <>
                  {'always' in details.times ? (
                    <>
                      <dt>{t('出没')}</dt>
                      <dd>{details.times.always === 'up' ? t('终年不落（拱极）') : t('终年不升')}</dd>
                    </>
                  ) : (
                    <>
                      <dt>{t('升起')}</dt>
                      <dd>{clock(details.times.rise)}</dd>
                      <dt>{t('落下')}</dt>
                      <dd>{clock(details.times.set)}</dd>
                    </>
                  )}
                </>
              )}
              {details?.mansion && (
                <>
                  <dt>{t('宿')}</dt>
                  <dd className={`sky-mansion-cell zone-${details.mansion.zone}`}>{mansionName(details.mansion.name)}</dd>
                </>
              )}
              {'key' in pick && details?.distance && (
                <>
                  <dt>{t('距离')}</dt>
                  <dd>{distanceText(pick, details.distance)}</dd>
                </>
              )}
              {!('key' in pick) && (
                <>
                  <dt>{t('颜色')}</dt>
                  <dd>{starTone(pick.bv)}</dd>
                </>
              )}
            </dl>
            {/* Its path today, and for a body its track over the past months */}
            <div className="sky-switches">
              <SkySwitch on={showPaths} label={t('今日轨迹')} onChange={togglePaths} />
              <SkySwitch on={tracking} label={t('跟踪')} onChange={toggleTracking} />
              {'key' in pick && (
                <>
                  <SkySwitch on={history.on} label={t('历史轨迹')} onChange={() => setHistory((h) => ({ ...h, on: !h.on }))} />
                  {history.on && (
                    <div className="seg small" role="group" aria-label={t('时长')}>
                      {(
                        [
                          [30, t('1 个月')],
                          [90, t('3 个月')],
                          [365, t('1 年')],
                        ] as const
                      ).map(([days, label]) => (
                        <button
                          key={days}
                          type="button"
                          className={history.days === days ? 'on' : undefined}
                          aria-pressed={history.days === days}
                          onClick={() => setHistory((h) => ({ ...h, days }))}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            {introText}
          </div>
        ) : (
          <table className="star-table sky-table">
            <thead>
              <tr>
                <th>{t('天体')}</th>
                <th>{t('方位')}</th>
                <th>{t('高度')}</th>
                <th>{t('星等')}</th>
                {figures === 'mansions' && <th>{t('宿')}</th>}
              </tr>
            </thead>
            <tbody>
              {sky.bodies.map((b) => (
                <tr
                  key={b.key}
                  className={[b.alt < 0 && 'below', focus === b.key && 'on'].filter(Boolean).join(' ') || undefined}
                  {...focusProps(b.key)}
                  tabIndex={0}
                  onClick={() => choose(b.key)}
                  onKeyDown={chooseKeys(b.key)}
                  data-sound="pick"
                >
                  <td>
                    <span className="sky-dot" style={{ background: BODY_COLOUR[b.key] }} />
                    {t(b.name)}
                  </td>
                  <td>{azimuth(b.az)}</td>
                  <td>{b.alt < 0 ? t('地平线下') : `${b.alt.toFixed(1)}°`}</td>
                  <td>{b.mag.toFixed(1)}</td>
                  {figures === 'mansions' && (
                    <td className={`sky-mansion-cell zone-${mansionOf(b.ra).mansion.zone}`}>{mansionName(mansionOf(b.ra).mansion.name)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </aside>

      {/* 显示, how the sky is drawn, in the drawer on the left as the calendar's 显示 is; the notes under it */}
      <DrawerPageTab label={t('显示')} title={t('星图上显示')} count={0}>
        <div className="sky-options sky-drawer-options">
        <span className="sky-option-title">{t('视角')}</span>
        <div className="seg small" role="group" aria-label={t('视角')}>
          {(
            [
              ['up', t('头顶')],
              ['down', t('脚下')],
              ['dome', t('穹顶')],
            ] as const
          ).map(([v, label]) => {
            const on = dome ? v === 'dome' : v === (below ? 'down' : 'up')
            return (
              <button
                key={v}
                type="button"
                className={on ? 'on' : undefined}
                aria-pressed={on}
                onClick={() => {
                  setDome(v === 'dome')
                  setBelow(v === 'down')
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
        {dome && (
          <SkySwitch on={showGround} label={t('地面（半透明，看得到脚下的星空）')} onChange={toggleGround} />
        )}
        <span className="sky-option-title">{t('星座')}</span>
        <div className="seg small" role="group" aria-label={t('星座')}>
          {(
            [
              ['none', t('不显示')],
              ['west', t('西方星座')],
              ['china', t('中国星官')],
              ['mansions', t('二十八宿')],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" className={figures === v ? 'on' : undefined} aria-pressed={figures === v} onClick={() => pickFigures(v)}>
              {label}
            </button>
          ))}
        </div>
        <span className="sky-option-title">{t('深空天体')}</span>
        <SkySwitch on={showDso} label={t('梅西耶天体：星系、星团、星云')} onChange={toggleDso} />
        <span className="sky-option-title">{t('坐标')}</span>
        <SkySwitch on={eqGrid} label={t('赤道坐标网')} onChange={toggleEqGrid} />
        <SkySwitch on={showEcliptic} label={t('黄道')} onChange={toggleEcliptic} />
        <span className="sky-option-title">{t('轨迹')}</span>
        <SkySwitch on={showPaths} label={t('日月行星前后 12 小时的路径')} onChange={togglePaths} />
        <span className="sky-option-title">{t('光污染')}</span>
        <label className="sky-bortle">
          <input type="range" min={1} max={9} step={1} value={bortle} aria-label={t('光污染')} onChange={(e) => pickBortle(Number(e.target.value))} />
          <span>{t('{n} 级 · {name}', { n: bortle, name: t(dark.name) })}</span>
        </label>
        <span className="sky-option-title">{t('今晚观星')}</span>
        <SkySwitch on={showNight} label={t('每小时适不适合观星，列在天体表上方')} onChange={toggleNight} />
        <span className="sky-option-title">{t('云量')}</span>
        <SkySwitch on={weatherOn} label={t('联网取云量预报，画在星图上')} onChange={toggleWeather} />
        <span className="sky-option-title">{t('夜视')}</span>
        <SkySwitch on={red} label={t('红光模式：整页变暗红，不破坏暗适应')} onChange={toggleRed} />
        <span className="sky-option-title">{t('画质')}</span>
        <div className="seg small" role="group" aria-label={t('画质')} title={t('流畅：少画一些暗星和银河的细节，不闪烁、无流星，缩放和拖动更顺')}>
          {(
            [
              ['clear', t('清晰')],
              ['smooth', t('流畅')],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" className={quality === v ? 'on' : undefined} aria-pressed={quality === v} onClick={() => pickQuality(v)}>
              {label}
            </button>
          ))}
        </div>
        </div>
        {notes}
        {sources}
      </DrawerPageTab>

      {createPortal(
        <div
          className={`sky-backdrop${dragging ? ' dragging' : ''}${frame ? '' : ' unplaced'}`}
          style={{ '--clear': (1 - 0.85 * cover).toFixed(2) } as CSSProperties}
        >
          {domeOn ? (
            <SkyDome
              scene={{
                utc,
                latitude: place.latitude,
                longitude: place.longitude,
                bodies: sky.bodies,
                light: sky.light,
                limit: canvasLight.limit,
                figures,
                en,
                name: (zh) => t(zh),
                ground: showGround,
                deepSky: showDso,
                paths: domePaths,
                history: domeHistory,
                eqGrid,
                ecliptic: showEcliptic,
                mark: domeMark,
              }}
              viewRef={domeView}
              draggable
              onPick={(key) => setChosen(key)}
              onLook={onLook}
            />
          ) : (
          <div className="sky-turner" ref={turnerRef}>
          <div className="sky-zoomer" ref={zoomerRef} style={{ '--over': `${over}px` } as CSSProperties}>
          {backdrop}
          <div
            className={`sky-canvas${entering ? ' entering' : ''}${spot ? ' dim' : ''}`}
            style={{ transformOrigin: mapStyle.transformOrigin }}
            aria-hidden="true"
          >
            <canvas ref={glowRef} className="glow" />
            <canvas ref={canvasRef} className="stars" />
            <canvas ref={cloudsRef} className="clouds" />
          </div>
          {map}
          {/* The Moon and, zoomed in, the planets as globes (SkyGlobe), over the map where each is, set
              upright with the zenith towards the map's centre; the map's hit circles below take the pointer */}
          <div className={`sky-globes${entering ? ' entering' : ''}`} aria-hidden="true">
            {frame &&
              [...up.filter((b) => b.key !== 'moon'), ...up.filter((b) => b.key === 'moon')].map((b) => {
                const half = globeOf(b)
                if (!half) return null
                const [x, y] = at(b.az, b.alt)
                const px = half * scale
                return (
                  <div
                    key={b.key}
                    className={`sky-globe-box sky-globe-${b.key}${spot && chosen !== b.key ? ' dim' : ''}`}
                    style={{
                      left: centre[0] + (x - C) * scale - px,
                      top: centre[1] + (y - C) * scale - px,
                      width: 2 * px,
                      height: 2 * px,
                      transform: `rotate(${upTurn(x, y).toFixed(1)}deg)${below ? ' scaleX(-1)' : ''}`,
                    }}
                  >
                    <SkyGlobe kind={b.key} face={faces[b.key]!} pixels={2 * px * Math.min(2, window.devicePixelRatio || 1)} />
                  </div>
                )
              })}
          </div>
          <div className={`sky-twinkles${entering ? ' entering' : ''}`} aria-hidden="true">
            {twinkles.map((tw) => (
              <i
                key={tw.hip}
                style={
                  {
                    left: tw.x,
                    top: tw.y,
                    '--c': tw.colour,
                    '--s': `${tw.size.toFixed(1)}px`,
                    animationDuration: `${2.6 + (tw.hip % 7) * 0.45}s`,
                    animationDelay: `${-((tw.hip % 13) * 0.37)}s`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          </div>
          </div>
          )}
          {pointingOn && (
            <div className="sky-point-bar">
              {heldOn ? (
                <>
                  <small>{t('正在看别处 · 晃一下手机回到对准')}</small>
                  <button type="button" className="ghost" onClick={letGo}>
                    {t('回到对准')}
                  </button>
                </>
              ) : (
                <small>{t('举起手机对准天空，也可以划动看看别处。方向靠手机的指南针，可能有偏差；不准时把手机画几个 8 字校准。')}</small>
              )}
              <button type="button" className="ghost" onClick={stopPointing}>
                {t('退出')}
              </button>
            </div>
          )}
          <div className="sky-meteor" ref={meteorRef} aria-hidden="true" />
          <div className="sky-tip" ref={tipRef} aria-hidden="true" />
          {/* What sits on the sky's window and does not zoom: the readout or hint, and the zoom buttons */}
          {frame && domeOn && !pointingOn && (
            <div className="sky-frame" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}>
              <div className="sky-drag-hint dome" aria-hidden="true">
                {t('拖动环顾四周 · 双指或滚轮缩放')}
              </div>
            </div>
          )}
          {frame && !domeOn && (
            <div className="sky-frame" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}>
              {dragShift !== null || speed ? (
                <div className="sky-drag-chip" aria-live="off">
                  {wall.date} {wall.time} · {dragShift !== null ? shiftLabel(dragShift) : rateLabel(speed)}
                </div>
              ) : (
                <>
                  <div className="sky-readout" ref={readoutRef} aria-hidden="true" />
                  <div className="sky-drag-hint" aria-hidden="true">
                    {view.z > Z_MIN ? t('拖动移动星图 · 中键左右拖动转动时间') : t('滚轮或双指缩放 · 左右拖动转动时间')}
                  </div>
                </>
              )}
              <div className="sky-zoom-buttons" role="group" aria-label={t('缩放')}>
                <button type="button" data-sound="zoomIn" aria-label={t('放大')} title={t('放大')} disabled={view.z >= Z_MAX} onClick={() => zoomBy(1.6)}>
                  +
                </button>
                <button type="button" data-sound="zoomOut" aria-label={t('缩小')} title={t('缩小')} disabled={view.z <= Z_MIN} onClick={() => zoomBy(1 / 1.6)}>
                  −
                </button>
                <button type="button" data-sound="zoomOut" aria-label={t('复原')} title={t('复原')} disabled={view.z <= Z_MIN} onClick={() => glideTo({ z: 1, x: 0, y: 0 })}>
                  ⟲
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </section>
  )
}

/** A named star: it can be hovered and chosen */
function Star({
  star: s,
  tip,
  at,
  size,
  light,
  seen,
  hit,
  on,
  hover,
  chooseProps,
}: {
  star: SkyStar
  /** Its name, direction and altitude, for a named star */
  tip?: string
  /** The map's projection (it depends on which half of the sky is shown) */
  at: (az: number, alt: number) => [number, number]
  /** How much of its size it keeps as the map zooms */
  size: number
  /** Its light: the gradient of its colour */
  light: string
  /** How well it shows through the sky's own light (1, or less in a town) */
  seen: number
  /** The least radius the pointer finds it in, in map units */
  hit: number
  /** Whether it is the chosen one, and whether it is under the pointer */
  on: boolean
  hover: boolean
  /** To choose it */
  chooseProps: React.SVGProps<SVGGElement>
}) {
  const [x, y] = at(s.az, s.alt)
  const r = starRadius(s.mag) * size
  return (
    <g className={`sky-star${on ? ' on' : ''}${hover ? ' hover' : ''}`} aria-label={tip} data-tip={tip} {...chooseProps}>
      <circle className="hit" cx={x} cy={y} r={Math.max(r + hit * 0.4, hit)} />
      <circle className="disc" cx={x} cy={y} r={glowRadius(s.mag) * size} fill={light} fillOpacity={starAlpha(s.mag) * seen} />
    </g>
  )
}

/** A switch: its label, and a track whose knob slides across when it is on */
function SkySwitch({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`sky-switch${on ? ' on' : ''}`} data-sound={on ? 'off' : 'on'} onClick={onChange}>
      <span className="sky-switch-label">{label}</span>
      <span className="sky-switch-track" aria-hidden="true" />
    </button>
  )
}

/** What a chosen mansion is: its 四象, its 七曜 animal, its 距星 and its 宿度 */
function MansionFacts({ name }: { name: string }) {
  const t = useT()
  const { language } = useSettings()
  const x = MANSIONS.findIndex((m) => m.name === name)
  if (x < 0) return null
  const m = MANSIONS[x]
  const en = language === 'en'
  return (
    <>
      {t('二十八宿')} · {en ? ZONES[m.zone].en : ZONES[m.zone].name} · {m.animal} ·{' '}
      {t('距星 {star}', { star: en ? m.starWestEn : `${m.star}（${m.starWest}）` })} ·{' '}
      {t('宿度 {width}°', { width: mansionWidth(x).toFixed(1) })}
    </>
  )
}

/** A deep-sky object's mark, as star atlases draw them: an ellipse for a galaxy, a circle crossed for
 *  a globular cluster, a dashed circle for an open one, a square for a nebula, a ringed dot for a
 *  planetary nebula */
function DsoMark({ m, x, y, r }: { m: Messier; x: number; y: number; r: number }) {
  switch (m.kind) {
    case 'galaxy':
      return <ellipse className="mark" cx={x} cy={y} rx={r} ry={r * Math.max(0.45, m.size[1] / m.size[0])} />
    case 'gc':
      return (
        <>
          <circle className="mark" cx={x} cy={y} r={r} />
          <path className="mark" d={`M${x - r} ${y}h${2 * r}M${x} ${y - r}v${2 * r}`} />
        </>
      )
    case 'oc':
    case 'asterism':
      return <circle className="mark dashed" cx={x} cy={y} r={r} />
    case 'pn':
      return (
        <>
          <circle className="mark" cx={x} cy={y} r={r * 0.6} />
          <path className="mark" d={`M${x - r} ${y}h${r * 0.4}M${x + r} ${y}h${-r * 0.4}M${x} ${y - r}v${r * 0.4}M${x} ${y + r}v${-r * 0.4}`} />
        </>
      )
    default:
      return <rect className="mark" x={x - r} y={y - r} width={2 * r} height={2 * r} rx={r * 0.2} />
  }
}
