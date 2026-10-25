import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { toUtc, type StarPlace } from '../lib/astrology'
import { WESTERN } from '../lib/constellations'
import {
  PATH_BODIES,
  constellationsAt,
  formatAzimuth,
  historyTrack,
  litPart,
  moonPhaseName,
  towards,
  mansionsAt,
  milkyWayAt,
  skyAt,
  trackOf,
  tracksAt,
  type SkyBody,
  type SkyStar,
} from '../lib/sky'
import { MANSIONS, ZONES, mansionOf, mansionWidth, type MansionZone } from '../lib/mansions'
import { XINGGUAN } from '../lib/xingguan'
import { useSettings, useT } from '../settingsContext'
import { DateParts } from './BirthForm'
import { TitleMark } from './Logo'
import { play } from '../sound'

// The map: the horizon is the rim, the zenith the centre, altitude falling off
// evenly outwards. North is up and east is LEFT, as when looking up at the sky.
const C = 200
const R = 170
const project = (az: number, alt: number): [number, number] => {
  const r = (R * (90 - alt)) / 90
  const a = (az * Math.PI) / 180
  return [C - r * Math.sin(a), C - r * Math.cos(a)]
}

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
const SKYLINE = (() => {
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
const GROUND = groundFrom(`M${C - R} ${C}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z`)
/** Azimuth ticks just outside the horizon, every 5° (longer every 30°) */
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const a = (i * 5 * Math.PI) / 180
  const [r0, r1] = [R + 2, R + (i % 6 === 0 ? 9 : 5)]
  return `M${(C - r0 * Math.sin(a)).toFixed(1)} ${(C - r0 * Math.cos(a)).toFixed(1)}L${(C - r1 * Math.sin(a)).toFixed(1)} ${(C - r1 * Math.cos(a)).toFixed(1)}`
}).join('')
/** The sky's colours from the zenith (first) out to the horizon, by how much sunlight there is */
const SKY_STOPS: Record<string, [number, string][]> = {
  night: [[0, '#04081a'], [0.55, '#091027'], [0.85, '#111a39'], [1, '#1b2850']],
  twilight: [[0, '#0b1433'], [0.55, '#182553'], [0.85, '#2c3a6e'], [1, '#4a5486']],
  day: [[0, '#3c6aa3'], [0.7, '#5e8cc4'], [1, '#a9c7e6']],
  below: [[0, '#0b0806'], [0.7, '#15100c'], [1, '#221a14']],
}
/** The glow low in the sky all round (airglow, a town's light): its colour and strength */
const HORIZON_GLOW: Record<string, [string, number]> = {
  night: ['#5a6eb0', 0.26],
  twilight: ['#7d84c4', 0.4],
  day: ['#e8f1ff', 0.35],
  below: ['#6a4a30', 0.25],
}
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Star colour from its B−V index: hot blue-white to cool orange */
const starColour = (bv: number) =>
  bv < 0 ? '#a9bfff' : bv < 0.3 ? '#d4dfff' : bv < 0.6 ? '#f8f7ff' : bv < 1 ? '#fff1dc' : bv < 1.4 ? '#ffd6a8' : '#ffb98a'
const starRadius = (mag: number) => Math.max(0.6, 3.2 - 0.55 * mag)

export const BODY_COLOUR: Record<string, string> = {
  earth: '#5b9bf0',
  pluto: '#c8b6a6',
  sun: '#ffcf4a',
  moon: '#ece6d6',
  mercury: '#c9bfb1',
  venus: '#fff3c9',
  mars: '#ff8a62',
  jupiter: '#f4d7a8',
  saturn: '#ead28f',
  uranus: '#a8e6e8',
  neptune: '#8ea9f3',
}
const bodyRadius = (b: SkyBody) => (b.key === 'sun' ? 8 : b.key === 'moon' ? 7 : Math.min(5, Math.max(2.4, 3.6 - 0.35 * b.mag)))
/** Dragging the sky across the disc turns the time by six hours (later to the right, as the stars go) */
const DRAG_MINUTES = 360 / (2 * R)
/** How far the map zooms: from fitting its window to eight times that */
const Z_MIN = 1
const Z_MAX = 8

interface Label {
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
function placeLabels(points: { key: string; text: string; x: number; y: number; r: number; kind: Label['kind'] }[], k: number) {
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


// Paths: where each body goes from 12 hours before the moment shown to 12
// hours after, sampled every 10 minutes, with a dot on each whole local hour.
const PATH_SPAN = 12 * 3600_000
const PATH_STEP = 10 * 60_000
const HOUR = 3600_000
const PATHS_KEY = 'chroniq-sky-paths'

// Constellation figures: Western, the Chinese 星官, the 二十八宿 alone, or none
type FigureSet = 'none' | 'west' | 'china' | 'mansions'
/** The 28 mansions' figures (rank 1 in the 星官), each with its mansion, for its 四象 colour */
const MANSION_FIGURES = XINGGUAN.filter((c) => c.rank === 1)
const MANSION_BY_NAME = new Map(MANSIONS.map((x, i) => [x.name, { ...x, index: i }]))
/** 角宿 → 角宿 / 角宿 in the 星官 data's 繁體 */
const MANSION_TRAD = new Map(MANSION_FIGURES.map((c) => [c.name, c.trad]))
const zoneOf = (name: string): MansionZone | undefined => MANSION_BY_NAME.get(name)?.zone
const FIGURES_KEY = 'chroniq-sky-figures'

/** SVG path data through the projected points */
const pathData = (points: { az: number; alt: number }[], pt: (az: number, alt: number) => [number, number] = project) =>
  points.map((p, i) => `${i ? 'L' : 'M'}${pt(p.az, p.alt).map((v) => v.toFixed(1)).join(' ')}`).join('')

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month, day }
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
export function SkyView({ place, placeControls }: { place: StarPlace; placeControls?: ReactNode }) {
  const t = useT()
  const { language, script } = useSettings()
  const en = language === 'en'
  const azimuth = (az: number) => formatAzimuth(az, language)
  const [now, setNow] = useState(() => new Date())
  const [picked, setPicked] = useState<{ date: string; time: string } | null>(null)
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
  // 头顶 / 脚下: the half of the sky above the horizon, or the half beneath one's feet, seen as if
  // through the Earth: the nadir in the middle, and east and west swapped (looking down, east is right).
  const [below, setBelow] = useState(false)
  const shown = (alt: number) => (below ? alt < 0 : alt >= 0)
  const at = (az: number, alt: number) => (below ? project((360 - az) % 360, -alt) : project(az, alt))
  const sky = useMemo(() => skyAt(utc, place.latitude, place.longitude, below), [utc, place.latitude, place.longitude, below])

  // ---- The sky as the page's backdrop ----
  // The map fills the screen behind the page (in <body>), fitted at first to the empty "window"
  // the page leaves for it: the controls and the table float beside it. On a wide screen the page
  // holds still (sticky, as the calendar does) and the footer slides up over it when scrolled to;
  // on a phone the page scrolls up over the sky, which stays where the window was at the top.
  const windowRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
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
  const dot = Math.round((1 / Math.sqrt(view.z)) * 100) / 100
  const centre = frame ? [frame.left + frame.width / 2 + view.x, frame.top + frame.height / 2 + view.y] : [C, C]
  /** Keeps the zoom in range, and the window's centre on the sky */
  const clampView = (v: { z: number; x: number; y: number }) => {
    const f = frameRef.current
    const z = Math.min(Z_MAX, Math.max(Z_MIN, v.z))
    const room = f ? (R * Math.min(f.width, f.height) * (z - 1)) / (2 * C) : 0
    const off = Math.hypot(v.x, v.y)
    const keep = off > room ? room / off : 1
    return { z, x: v.x * keep, y: v.y * keep }
  }
  /** Zooms by a factor about a point on the screen, which stays where it is */
  const zoomAt = (fx: number, fy: number, factor: number) =>
    setView((v) => {
      const f = frameRef.current
      if (!f) return v
      const z = Math.min(Z_MAX, Math.max(Z_MIN, v.z * factor))
      const wx = f.left + f.width / 2
      const wy = f.top + f.height / 2
      const grow = z / v.z
      return clampView({ z, x: fx - (fx - (wx + v.x)) * grow - wx, y: fy - (fy - (wy + v.y)) * grow - wy })
    })
  const zoomBy = (factor: number) => {
    const f = frameRef.current
    if (f) zoomAt(f.left + f.width / 2 + viewRef.current.x, f.top + f.height / 2 + viewRef.current.y, factor)
  }

  // The bodies' paths across the sky, on unless switched off (remembered in this browser)
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
  const [chosen, setChosen] = useState<string | null>(null)
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
    try {
      const v = localStorage.getItem(FIGURES_KEY)
      return v === 'china' || v === 'none' || v === 'mansions' ? v : 'west'
    } catch {
      return 'west'
    }
  })
  const pickFigures = (v: FigureSet) => {
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
            utc,
            place.latitude,
            place.longitude,
            below,
          ),
    [figures, utc, place.latitude, place.longitude, below],
  )
  // 二十八宿: the mansions' boundaries along the equator, with their names (lib/sky.ts mansionsAt)
  const mansionView = useMemo(
    () => (figures === 'mansions' ? mansionsAt(utc, place.latitude, place.longitude) : null),
    [figures, utc, place.latitude, place.longitude],
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

  // One body's way among the stars over the past days, drawn on tonight's sky
  const [history, setHistory] = useState<{ body: SkyBody['key'] | null; days: number }>({ body: null, days: 90 })
  // While the sky is dragged through time, the paths and the history track (too slow to redo at
  // every step) wait until it is let go
  const [dragShift, setDragShift] = useState<number | null>(null)
  const dragging = dragShift !== null
  const historyLine = useMemo(() => {
    if (!history.body || dragging) return null
    const points = historyTrack(history.body, utc, place.latitude, place.longitude, history.days)
    // A date mark every week (1 month), half month (3 months) or month (1 year), counted back from now
    const tickDays = history.days <= 31 ? 7 : history.days <= 92 ? 15 : 30
    const stride = Math.round(((points.length - 1) * tickDays) / history.days)
    const ticks = []
    for (let i = points.length - 1 - stride; i >= 0; i -= stride) {
      const [, m, d] = wallTime(points[i].utc, place.timeZone).date.split('-').map(Number)
      ticks.push({ ...points[i], m, d })
    }
    return { key: history.body, d: pathData(points, at), start: points[0], ticks }
  }, [history, dragging, utc, place.latitude, place.longitude, place.timeZone])
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
  const paths = useMemo(() => {
    // Left out while the sky is dragged through time (the chosen one's path stays: extraPath)
    if (!pathTimes || dragging) return null
    const tracks = tracksAt([...pathTimes.times, ...pathTimes.hours], place.latitude, place.longitude)
    return PATH_BODIES.map((key) => pathOf(key, tracks[key]))
    // dragging too: letting go must bring them back, though the time has not moved since the last step
  }, [pathTimes, dragging, place.latitude, place.longitude])
  const clipId = useId()
  const pick = chosen?.startsWith('hip') ? sky.stars.find((s) => `hip${s.hip}` === chosen) : sky.bodies.find((b) => b.key === chosen)
  // A constellation or 星官 can be chosen too (its key is fig + its id)
  const pickFigure = chosen?.startsWith('fig') ? figureViews.find((c) => `fig${c.id}` === chosen) : undefined
  // A star that has set, or is on the other half of the sky now, lets go; so does a figure gone from view
  useEffect(() => {
    if (chosen && !pick && !pickFigure) setChosen(null)
  }, [chosen, pick, pickFigure])
  const pickName = pick && ('key' in pick ? t(pick.name) : t(pick.name!))
  const pickColour = pick && ('key' in pick ? BODY_COLOUR[pick.key] : starColour(pick.bv))
  const pickRadius = pick && ('key' in pick ? bodyRadius(pick) : starRadius(pick.mag))
  // Where the chosen one is on the map, if it is on this half of the sky
  const spot = pick && shown(pick.alt) ? at(pick.az, pick.alt) : null
  // The path of a star, or of a body without one among the usual (Uranus, Neptune), when it is
  // chosen or hovered, drawn like the others while the paths are on. While the sky is dragged
  // through time the usual paths wait, but the chosen one's is still drawn, whichever it is.
  // Tracks already worked out for these moments and this place, so hovering the same star again is free
  const trackCache = useMemo(() => new Map<string, { az: number; alt: number }[]>(), [pathTimes, place.latitude, place.longitude])
  const extraPath = (key: string | null) => {
    if (!pathTimes || !key || key.startsWith('fig') || (PATH_BODIES.includes(key as SkyBody['key']) && !dragging)) return null
    let track = trackCache.get(key)
    if (!track) {
      const what = key.startsWith('hip') ? { hip: Number(key.slice(3)) } : { body: key as SkyBody['key'] }
      track = trackOf(what, [...pathTimes.times, ...pathTimes.hours], place.latitude, place.longitude)
      trackCache.set(key, track)
    }
    return track.length ? pathOf(key, track) : null
  }
  const chosenPath = useMemo(() => extraPath(chosen), [pathTimes, dragging, chosen, place.latitude, place.longitude])
  const hoverPath = useMemo(
    () => (focus === chosen || dragging ? null : extraPath(focus)),
    [pathTimes, dragging, focus, chosen, place.latitude, place.longitude],
  )
  const allPaths = pathTimes && [...(paths ?? []), ...(chosenPath ? [chosenPath] : []), ...(hoverPath ? [hoverPath] : [])]
  // The paths picked out: the chosen one's, and the hovered one's
  const litPaths = allPaths?.filter((p) => p.key === chosen || p.key === focus) ?? []
  const colourOf = (key: string) => {
    const st = key.startsWith('hip') ? sky.stars.find((x) => `hip${x.hip}` === key) : undefined
    return st ? starColour(st.bv) : BODY_COLOUR[key]
  }
  /** Where on the map the thing a path belongs to is now */
  const whereNow = (key: string) => {
    const o = key.startsWith('hip') ? sky.stars.find((st) => `hip${st.hip}` === key) : sky.bodies.find((b) => b.key === key)
    return o && shown(o.alt) ? at(o.az, o.alt) : null
  }
  const up = sky.bodies.filter((b) => shown(b.alt))
  /** Which way (degrees, on the map) the Sun lies from the Moon: its lit side faces that way */
  const moonTurn = (moon: SkyBody) => {
    const [x0, y0] = at(moon.az, moon.alt)
    const step = towards(moon, sky.bodies[0], 0.5)
    const [x1, y1] = at(step.az, step.alt)
    return (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI
  }
  const light = below ? 'below' : sky.light
  // The Milky Way (lib/sky.ts milkyWayModel): its glow as soft patches that overlap into a haze,
  // its dust as dark ones, and its grain as tiny dots in three brightnesses, one path each (a dot is
  // a round cap on a line of next to no length)
  const galaxy = useMemo(() => milkyWayAt(utc, place.latitude, place.longitude), [utc, place.latitude, place.longitude])
  const milkyWay = useMemo(() => {
    const seen = (alt: number) => (below ? alt < 4 : alt > -4)
    const grain = ['', '', '']
    const { az, alt, weight } = galaxy.grain
    for (let i = 0; i < az.length; i++) {
      if (!seen(alt[i])) continue
      const [x, y] = at(az[i], alt[i])
      grain[weight[i]] += `M${x.toFixed(1)} ${y.toFixed(1)}h.01`
    }
    // Sizes are in degrees: R / 90 map units to the degree
    const patches = (list: typeof galaxy.glow) =>
      list.filter((p) => seen(p.alt)).map((p) => {
        const [x, y] = at(p.az, p.alt)
        return { x, y, r: ((p.size ?? 4) * R) / 90, a: p.weight }
      })
    // The band as short strokes along its centre line, each as wide as the band is there and as
    // bright; drawn in three blurred layers (styles.css .mw-haze / .mw-body / .mw-core) they run
    // together into one continuous, brighter-cored band. The Great Rift is a dark stroke over it.
    const deg = R / 90
    const line = (list: typeof galaxy.rift) =>
      list
        .map((p, i) => {
          const [x, y] = at(p.az, p.alt)
          return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
        })
        .join('')
    const strokes = (list: typeof galaxy.spine, closed: boolean) => {
      const out: { d: string; w: number; a: number }[] = []
      const n = closed ? list.length : list.length - 1
      for (let i = 0; i < n; i++) {
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
    // Each blurred layer as a few paths rather than a stroke each: strokes of about the same
    // opacity (to 0.02) and width (to half a unit) share one path, which under the blur looks the
    // same and is far less to redraw as the sky turns
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
    const band = strokes(galaxy.spine, true)
    return {
      grain,
      glow: patches(galaxy.glow),
      // The rift's own patches would bead along the line drawn below: only the Coalsack stays a patch
      dust: patches(galaxy.dust.filter((p) => p.l > 180)),
      haze: layer(band, 3.4, (a) => Math.min(0.32, 0.09 + 0.14 * a)),
      body: layer(band, 1.7, (a) => Math.min(0.55, 0.1 + 0.28 * a)),
      core: layer(band, 0.75, (a) => (a > 0.55 ? Math.min(0.6, 0.5 * (a - 0.55)) : 0)),
      // The rift as continuous lines (separate strokes would bead): a thin one along its whole
      // length and a wider one where it is deepest, Aquila to Cygnus
      rift: [
        { d: line(galaxy.rift), w: 1.6 * deg, a: 0.6 },
        { d: line(galaxy.rift.filter((p) => p.l >= 18 && p.l <= 72)), w: 2.8 * deg, a: 0.6 },
      ],
    }
    // at follows below
  }, [galaxy, below])
  // The layers that only change with the sky itself are made once per sky, so hovering, choosing or
  // panning (which redraw the page) leave them alone
  const milkyWayLayer = useMemo(
    () => (
      <g className="sky-milkyway" aria-hidden="true">
        {/* Brightness runs about 0.2 (anticentre) to 1.6 (the centre, in Sagittarius) */}
        <g className="mw-haze" filter={`url(#${clipId}-mw-blur-wide)`}>
          {milkyWay.haze.map((g, i) => (
            <path key={i} d={g.d} strokeWidth={g.w} opacity={g.o} />
          ))}
        </g>
        <g className="mw-body" filter={`url(#${clipId}-mw-blur)`}>
          {milkyWay.body.map((g, i) => (
            <path key={i} d={g.d} strokeWidth={g.w} opacity={g.o} />
          ))}
        </g>
        <g className="mw-core" filter={`url(#${clipId}-mw-blur-fine)`}>
          {milkyWay.core.map((g, i) => (
            <path key={i} d={g.d} strokeWidth={g.w} opacity={g.o} />
          ))}
        </g>
        {milkyWay.glow.map((g, i) => (
          <circle key={i} cx={g.x} cy={g.y} r={g.r} fill={`url(#${clipId}-mw)`} opacity={g.a * 0.6} />
        ))}
        <g className="mw-rift" filter={`url(#${clipId}-mw-blur-fine)`}>
          {milkyWay.rift.map((b, i) => (
            <path key={i} d={b.d} strokeWidth={b.w} opacity={b.a} />
          ))}
        </g>
        {milkyWay.dust.map((g, i) => (
          <circle key={`dust-${i}`} cx={g.x} cy={g.y} r={g.r} fill={`url(#${clipId}-dust)`} opacity={g.a} />
        ))}
        {milkyWay.grain.map((d, i) => (
          <path key={`grain-${i}`} className={`grain grain-${i}`} d={d} />
        ))}
      </g>
    ),
    [milkyWay, clipId],
  )
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
        <g className={`sky-figures sky-figures-${figures}${pickFigure ? ' has-chosen' : ''}`} aria-hidden="true">
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
    below || sky.light === 'day' || !frame
      ? []
      : sky.stars
          .filter((st) => st.mag < 1.6 && st.alt > 6)
          .map((st) => {
            const [x, y] = at(st.az, st.alt)
            return { hip: st.hip, x: centre[0] + (x - C) * scale, y: centre[1] + (y - C) * scale, size: 14 + (1.6 - st.mag) * 7, colour: starColour(st.bv) }
          })
  // The stars without a name, which are only looked at, as one path of dots per colour rather than
  // hundreds of elements: far less to redraw as the sky is dragged through time
  const starDots = useMemo(() => {
    // A dot is a round cap on a stroke of next to no length, as wide as the star: much shorter to
    // write (and for the browser to read) than two arcs, so one path per colour and size. The
    // colours keep the order they come in, so that where two dots touch the same one is on top.
    const groups = new Map<string, Map<number, string>>()
    for (const st of sky.stars) {
      if (st.name) continue
      const [x, y] = at(st.az, st.alt)
      const width = Math.round(starRadius(st.mag) * dot * 40) / 20
      const colour = starColour(st.bv)
      const mark = `M${x.toFixed(1)} ${y.toFixed(1)}h.01`
      let sizes = groups.get(colour)
      if (!sizes) groups.set(colour, (sizes = new Map()))
      sizes.set(width, (sizes.get(width) ?? '') + mark)
    }
    return [...groups].flatMap(([colour, sizes]) => [...sizes].map(([width, d]) => ({ colour, width, d })))
    // at follows below, as sky does
  }, [sky, dot])
  const labels = useMemo(
    () =>
      placeLabels([
        ...sky.bodies
          .filter((b) => shown(b.alt))
          .sort((a, b) => a.mag - b.mag)
          .map((b) => {
            const [x, y] = at(b.az, b.alt)
            return { key: b.key, text: t(b.name), x, y, r: bodyRadius(b) * dot, kind: 'body' as const }
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
    [sky, figureViews, language, script, below, k, dot, pickFigure?.id],
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
    // The middle button turns the time at any zoom (and is kept from starting the browser's autoscroll)
    const middle = e.pointerType === 'mouse' && e.button === 1
    if (middle) e.preventDefault()
    else if (e.pointerType === 'mouse' && e.button !== 0) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      // A second finger: the drag becomes a pinch
      if (drag.current?.moved) dragged.current = true
      drag.current = null
      pinch.current = { ...pinchOf(), view: viewRef.current }
      return
    }
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, base: utc.getTime(), view: viewRef.current, time: middle || viewRef.current.z <= Z_MIN, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const p = pinch.current
    if (p && pointers.current.size === 2) {
      const now = pinchOf()
      const f = frameRef.current
      if (!f) return
      later(() => {
        // Zoom about where the pinch began, then follow the fingers' midpoint
        const z = Math.min(Z_MAX, Math.max(Z_MIN, (p.view.z * now.dist) / p.dist))
        const wx = f.left + f.width / 2
        const wy = f.top + f.height / 2
        const grow = z / p.view.z
        setView(
          clampView({
            z,
            x: p.mid[0] - (p.mid[0] - (wx + p.view.x)) * grow - wx + (now.mid[0] - p.mid[0]),
            y: p.mid[1] - (p.mid[1] - (wy + p.view.y)) * grow - wy + (now.mid[1] - p.mid[1]),
          }),
        )
      })
      return
    }
    const d = drag.current
    if (!d || d.id !== e.pointerId) {
      if (e.pointerType === 'mouse') pointAt(e)
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
    } else later(() => setView(clampView({ ...d.view, x: d.view.x + dx, y: d.view.y + dy })))
  }
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    if (pinch.current) {
      if (pointers.current.size < 2) {
        pinch.current = null
        dragged.current = true
      }
      return
    }
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (!d.moved) return
    dragged.current = true
    // After the last step has landed
    if (d.time) requestAnimationFrame(() => requestAnimationFrame(() => setDragShift(null)))
  }
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      const zoomIn = e.deltaY < 0
      // A trackpad pinch comes as the wheel with ctrl held: always a zoom
      if (!e.ctrlKey && (zoomIn ? window.scrollY > 0 : viewRef.current.z <= Z_MIN)) return
      e.preventDefault()
      const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY
      zoomAt(e.clientX, e.clientY, Math.exp(-step * (e.ctrlKey ? 0.01 : 0.0015)))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
    // zoomAt uses refs and setView only
  }, [])
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
    if (below || sky.light === 'day' || reducedMotion()) return
    let timer = 0
    const fire = () => {
      const el = meteorRef.current
      const f = frameRef.current
      if (el && f && el.animate && !document.hidden && !drag.current?.moved) {
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
  }, [below, sky.light])

  const lightNote = sky.light === 'day' ? t('太阳在地平线上，白天肉眼看不到星星，图中淡淡示意它们的位置。') : sky.light === 'twilight' ? t('晨昏蒙影中，只有最亮的星和行星可见。') : ''
  const map = (
    <svg
      ref={svgRef}
      className={`sky-map sky-${below ? 'below' : sky.light}${spot ? ' has-chosen' : ''}${pickFigure ? ' figure-chosen' : ''}${view.z > Z_MIN ? ' zoomed' : ''}${entering ? ' entering' : ''}`}
      style={{ '--k': k, transformOrigin: `${centre[0]}px ${centre[1]}px` } as CSSProperties}
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
      onPointerOver={(e) => e.pointerType === 'mouse' && showTip(e.target)}
      onPointerLeave={() => {
        pointAt(null)
        tipRef.current?.classList.remove('on')
      }}
    >
      <g ref={mapRef} transform={`translate(${(centre[0] - C * scale).toFixed(2)} ${(centre[1] - C * scale).toFixed(2)}) scale(${scale.toFixed(5)})`}>
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
          <stop offset={0.5} stopColor={HORIZON_GLOW[light][0]} stopOpacity={0} />
          <stop offset={0.86} stopColor={HORIZON_GLOW[light][0]} stopOpacity={HORIZON_GLOW[light][1] * 0.45} />
          <stop offset={1} stopColor={HORIZON_GLOW[light][0]} stopOpacity={HORIZON_GLOW[light][1]} />
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
          <stop offset={0} stopColor="#fffbea" stopOpacity={0.9} />
          <stop offset={0.25} stopColor="#fff3c4" stopOpacity={0.35} />
          <stop offset={1} stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${clipId}-moon`}>
          <stop offset={0} stopColor="#e4ebff" stopOpacity={1} />
          <stop offset={1} stopColor="#e4ebff" stopOpacity={0} />
        </radialGradient>
        {/* The Milky Way's blurs (in map units; one degree is R / 90 ≈ 1.9) */}
        <filter id={`${clipId}-mw-blur-wide`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={7} />
        </filter>
        <filter id={`${clipId}-mw-blur`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={3.5} />
        </filter>
        <filter id={`${clipId}-mw-blur-fine`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={1.6} />
        </filter>
        <radialGradient id={`${clipId}-mw`}>
          <stop offset={0} stopColor="#cdd6ff" stopOpacity={1} />
          <stop offset={0.45} stopColor="#b7c4f5" stopOpacity={0.45} />
          <stop offset={1} stopColor="#9fb0ea" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${clipId}-dust`}>
          <stop offset={0} stopColor="#03050d" stopOpacity={1} />
          <stop offset={0.5} stopColor="#03050d" stopOpacity={0.6} />
          <stop offset={1} stopColor="#03050d" stopOpacity={0} />
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
      <g clipPath={`url(#${clipId})`}>
        {milkyWayLayer}
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
        {figuresLayer}
        <g className="sky-halos" aria-hidden="true">
          {up
            .filter((b) => b.key !== 'sun')
            .map((b) => {
              const [x, y] = at(b.az, b.alt)
              const r = bodyRadius(b) * dot * (b.key === 'moon' ? 4.5 : 3.6)
              return <circle key={b.key} cx={x} cy={y} r={r} fill={`url(#${clipId}-halo)`} opacity={b.key === 'moon' ? 0.4 + 0.5 * b.lit : 0.55} />
            })}
          {sky.stars
            .filter((st) => st.mag < 1.2)
            .map((st) => {
              const [x, y] = at(st.az, st.alt)
              return <circle key={st.hip} cx={x} cy={y} r={starRadius(st.mag) * dot * 5} fill={`url(#${clipId}-halo)`} opacity={0.45} />
            })}
        </g>
        <g className="sky-stars">
          {starDots.map((g) => (
            <path key={`${g.colour} ${g.width}`} className="dots" stroke={g.colour} strokeWidth={g.width} d={g.d} />
          ))}
          {sky.stars.filter((s) => s.name).map((s) => (
            <Star
              key={s.hip}
              star={s}
              tip={s.name && t('{name} · {direction} · 高 {altitude}°', { name: t(s.name), direction: azimuth(s.az), altitude: s.alt.toFixed(1) })}
              at={at}
              size={dot}
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
              <g key={p.key} className={`sky-path${litPaths.includes(p) ? ' on' : ''}`} style={{ color: BODY_COLOUR[p.key] ?? colourOf(p.key) }}>
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
            <g className="sky-history" style={{ color: BODY_COLOUR[historyLine.key] }} aria-hidden="true">
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
          {up.map((b) => {
            const [x, y] = at(b.az, b.alt)
            const tip = t('{name} · {direction} · 高 {altitude}°', { name: t(b.name), direction: azimuth(b.az), altitude: b.alt.toFixed(1) })
            return (
              <g
                key={b.key}
                className={`sky-body sky-${b.key}${chosen === b.key ? ' on' : ''}${focus === b.key ? ' hover' : ''}`}
                aria-label={tip}
                data-tip={tip}
                {...chooseProps(b.key)}
                {...focusProps(b.key)}
              >
                <circle className="hit" cx={x} cy={y} r={Math.max(bodyRadius(b) * dot + 4 * k, 12 * k)} />
                {b.key === 'moon' ? (
                  // The Moon as it looks: its lit part (litPart) turned towards the Sun, the rest faintly
                  // there by earthshine. The turn is worked out on the map: a step from the Moon towards
                  // the Sun along the sky, projected, gives the way the Sun lies from it here.
                  <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${moonTurn(b).toFixed(1)})`}>
                    <g className="disc">
                      <circle className="moon-dark" r={bodyRadius(b) * dot} />
                      <path d={litPart(b.lit, bodyRadius(b) * dot)} fill={BODY_COLOUR.moon} />
                    </g>
                  </g>
                ) : (
                  <circle className="disc" cx={x} cy={y} r={bodyRadius(b) * dot} fill={BODY_COLOUR[b.key]} />
                )}
              </g>
            )
          })}
        </g>
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
            const push = l.key === chosen && spot ? pickRadius! * dot * 0.4 + 6 * k : 0
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
          <circle cx={spot[0]} cy={spot[1]} r={pickRadius! * dot * 1.4 + 6 * k} />
          <circle className="pulse" cx={spot[0]} cy={spot[1]} r={pickRadius! * dot * 1.4 + 6 * k} />
        </g>
      )}
      </g>
    </svg>
  )

  return (
    <section id="sky-now" className="sky-stage">
      <div className="sky-toolbar">
        <h3 className="section-title">
          <TitleMark />
          {t('此刻天空')}
        </h3>
        <div className="overlay-bar sky-controls">
          <DateParts
            label={t('日期')}
            value={ymd(wall.date)}
            onChange={(d) => setPicked({ ...wall, date: `${d.year}-${pad(d.month)}-${pad(d.day)}` })}
          />
          <input type="time" aria-label={t('时间')} value={wall.time} onChange={(e) => e.target.value && setPicked({ ...wall, time: e.target.value })} />
          <button
            type="button"
            className={`ghost toggle${picked ? '' : ' on'}`}
            aria-pressed={!picked}
            // Already following the clock: pressing again only refreshes it
            data-sound={picked ? 'on' : 'tap'}
            onClick={() => {
              setNow(new Date())
              setPicked(null)
            }}
          >
            {t('现在')}
          </button>
          <button type="button" className={`ghost toggle${showPaths ? ' on' : ''}`} aria-pressed={showPaths} onClick={togglePaths}>
            {t('轨迹')}
          </button>
        </div>
      </div>

      {/* Left empty: the sky behind the page shows through here */}
      <div className="sky-window" ref={windowRef} />

      <aside className="card sky-panel">
        {placeControls && <div className="sky-place bazi-form">{placeControls}</div>}
        <p className="muted row-note sky-when">
          {t('{place}上空 · 当地时间 {date} {time}', { place: t(place.name), date: wall.date, time: wall.time })}
          {picked ? '' : t('（随时间更新）')}
        </p>
        <div className="sky-options">
          <span className="sky-option-title">{t('视角')}</span>
          <div className="seg small" role="group" aria-label={t('视角')}>
            {(
              [
                [false, t('头顶')],
                [true, t('脚下')],
              ] as const
            ).map(([v, label]) => (
              <button key={label} type="button" className={below === v ? 'on' : undefined} aria-pressed={below === v} onClick={() => setBelow(v)}>
                {label}
              </button>
            ))}
          </div>
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
          <span className="sky-option-title">{t('历史轨迹')}</span>
          <div className="sky-history-pick">
            <select
              aria-label={t('历史轨迹')}
              value={history.body ?? ''}
              onChange={(e) => setHistory((h) => ({ ...h, body: (e.target.value || null) as SkyBody['key'] | null }))}
            >
              <option value="">{t('不显示')}</option>
              {sky.bodies.map((b) => (
                <option key={b.key} value={b.key}>
                  {t(b.name)}
                </option>
              ))}
            </select>
            {history.body && (
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
          </div>
        </div>

        {pickFigure && (
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
              {' · '}
              {azimuth(pickFigure.label.az)} · {t('高 {altitude}°', { altitude: pickFigure.label.alt.toFixed(1) })}
            </span>
            <button type="button" className="ghost sky-unchoose" data-sound="unpick" aria-label={t('取消选中')} title={t('取消选中')} onClick={() => setChosen(null)}>
              ✕
            </button>
          </div>
        )}
        {pick && (
          <div className="sky-chosen-info">
            <span className="sky-dot" style={{ background: pickColour }} />
            <strong>{pickName}</strong>
            <span className="muted">
              {azimuth(pick.az)} · {t('高 {altitude}°', { altitude: pick.alt.toFixed(1) })} · {t('星等 {mag}', { mag: pick.mag.toFixed(1) })}
              {'phase' in pick && pick.phase !== undefined && (
                <>
                  {' · '}
                  {t(moonPhaseName(pick.phase))} · {t('照亮 {n}%', { n: Math.round(pick.lit * 100) })}
                </>
              )}
            </span>
            {/* With the paths off, the chosen one's is a click away */}
            {!showPaths && (
              <button type="button" className="ghost sky-show-path" data-sound="on" onClick={togglePaths}>
                {t('显示轨迹')}
              </button>
            )}
            <button type="button" className="ghost sky-unchoose" data-sound="unpick" aria-label={t('取消选中')} title={t('取消选中')} onClick={() => setChosen(null)}>
              ✕
            </button>
          </div>
        )}
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
                className={[b.alt < 0 && 'below', focus === b.key && 'on', chosen === b.key && 'chosen'].filter(Boolean).join(' ') || undefined}
                {...focusProps(b.key)}
                tabIndex={0}
                aria-selected={chosen === b.key}
                onClick={() => choose(b.key)}
                onKeyDown={chooseKeys(b.key)}
                data-sound={chosen === b.key ? 'unpick' : 'pick'}
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
        <p className="muted row-note">
          {t('上为北、左为东，如仰望天空。这是天体在天上的实际位置，与星盘里以黄道十二宫计的星座不同。')}
          {en && ' '}
          {below ? t('脚下：地平线以下、被地球挡住的那半边天空，像透过地球往下看；中心是天底，东西因此左右互换。') : lightNote}
          {(below || lightNote) && en && ' '}
          {below
            ? t('地平线下有 {n} 颗 5 等以内的亮星。', { n: sky.stars.length })
            : t('地平线上有 {n} 颗 5 等以内的亮星，星点大小示亮度、颜色示温度。星表来自 d3-celestial（XHIP 依巴谷星表）。', { n: sky.stars.length })}
          {en && ' '}
          {t('点一下天体、有名字的亮星、星座连线或表格里的一行可把它选中（开着轨迹时也画出它的轨迹），再点一次、点空白处或按 Esc 取消；左右拖动星空可以转动时间。')}
          {paths && en && ' '}
          {paths && t('彩色弧线是日月和肉眼可见的行星前后 12 小时在天上走过的路径：虚线已走过，实线将要走，圆点是整点；悬停天体或表格里的一行可看各整点。')}
          {historyLine && en && ' '}
          {historyLine &&
            t('{name}过去 {span}在星空中走过的路线（画在此刻的星空上）：空心圆是起点，圆点标出日期；行星逆行时会折返或打圈。', {
              name: t(sky.bodies.find((b) => b.key === historyLine.key)!.name),
              span: history.days === 30 ? t('1 个月') : history.days === 90 ? t('3 个月') : t('1 年'),
            })}
          {figures !== 'none' && en && ' '}
          {figures === 'west' && t('星座连线来自 d3-celestial。')}
          {figures === 'china' && t('中国星官据 Stellarium 中国星空文化（CC BY-SA 4.0），经 d3-celestial 整理。')}
          {figures === 'mansions' &&
            t(
              '二十八宿按四象着色：青为东方苍龙、蓝为北方玄武、白为西方白虎、红为南方朱雀。虚线是各宿距星所在的赤经线，把天赤道（点线）分成二十八段，每段的宽窄就是宿度；表格里的「宿」是日月五星此刻所在的宿。星官连线据 Stellarium 中国星空文化（CC BY-SA 4.0）。',
            )}
        </p>
      </aside>

      {createPortal(
        <div className={`sky-backdrop${dragging ? ' dragging' : ''}${frame ? '' : ' unplaced'}`}>
          {map}
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
          <div className="sky-meteor" ref={meteorRef} aria-hidden="true" />
          <div className="sky-tip" ref={tipRef} aria-hidden="true" />
          {/* What sits on the sky's window and does not zoom: the readout or hint, and the zoom buttons */}
          {frame && (
            <div className="sky-frame" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}>
              {dragging ? (
                <div className="sky-drag-chip" aria-live="polite">
                  {wall.date} {wall.time} · {shiftLabel(dragShift)}
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
                <button type="button" data-sound="zoomOut" aria-label={t('复原')} title={t('复原')} disabled={view.z <= Z_MIN} onClick={() => setView({ z: 1, x: 0, y: 0 })}>
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
      <circle className="disc" cx={x} cy={y} r={r} fill={starColour(s.bv)} />
    </g>
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
