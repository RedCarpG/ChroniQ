import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { toUtc, type StarPlace } from '../lib/astrology'
import { WESTERN } from '../lib/constellations'
import {
  PATH_BODIES,
  constellationsAt,
  formatAzimuth,
  historyTrack,
  skyAt,
  tracksAt,
  type SkyBody,
  type SkyStar,
} from '../lib/sky'
import { XINGGUAN } from '../lib/xingguan'
import { useSettings, useT } from '../settingsContext'
import { DateParts } from './BirthForm'
import { TitleMark } from './Logo'

// The map: the horizon is the rim, the zenith the centre, altitude falling off
// evenly outwards. North is up and east is LEFT, as when looking up at the sky.
const C = 200
const R = 170
const project = (az: number, alt: number): [number, number] => {
  const r = (R * (90 - alt)) / 90
  const a = (az * Math.PI) / 180
  return [C - r * Math.sin(a), C - r * Math.cos(a)]
}

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
    const h = size + 2
    const spots: [number, number, Label['anchor'], number][] = [
      [p.x + p.r + 3, p.y, 'start', p.x + p.r + 3],
      [p.x - p.r - 3, p.y, 'end', p.x - p.r - 3 - w],
      [p.x, p.y - p.r - h / 2 - 2, 'middle', p.x - w / 2],
      [p.x, p.y + p.r + h / 2 + 2, 'middle', p.x - w / 2],
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

// Constellation figures: Western, the Chinese 星官, or none
type FigureSet = 'none' | 'west' | 'china'
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
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
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
  // The map is fixed behind the page (in <body>), where the empty "window" at the top of the page
  // is while the page is not scrolled: the controls and the table float beside it, and scrolling
  // down slides the 太阳系 card up over the sky.
  const windowRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  useLayoutEffect(() => {
    const el = windowRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const next = { left: r.left, top: r.top + window.scrollY, width: r.width, height: r.height }
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
  // The body whose path is picked out (hover or focus a body or its row), with its hours labelled
  const [focus, setFocus] = useState<string | null>(null)
  const focusProps = (key: string) =>
    PATH_BODIES.includes(key as SkyBody['key']) && showPaths
      ? {
          tabIndex: 0,
          onPointerEnter: (e: React.PointerEvent) => e.pointerType === 'mouse' && setFocus(key),
          onPointerLeave: (e: React.PointerEvent) => e.pointerType === 'mouse' && setFocus(null),
          onFocus: () => setFocus(key),
          onBlur: () => setFocus(null),
        }
      : {}
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
      return v === 'china' || v === 'none' ? v : 'west'
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
        : constellationsAt(figures === 'west' ? WESTERN : XINGGUAN, utc, place.latitude, place.longitude, below),
    [figures, utc, place.latitude, place.longitude, below],
  )
  // 星官 names stay Chinese in English, as proper nouns; both sets follow the 繁體 / 简体 setting
  const figureName = (c: { name: string; trad: string; en: string }) =>
    figures === 'west' && en ? c.en : script === 'trad' ? c.trad : c.name

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

  const paths = useMemo(() => {
    if (!showPaths || dragging) return null
    const now = utc.getTime()
    const times: Date[] = []
    for (let ms = now - PATH_SPAN; ms <= now + PATH_SPAN; ms += PATH_STEP) times.push(new Date(ms))
    // Whole local hours in the window (from the wall-clock minute, so odd offsets like +5:45 work)
    const start = now - PATH_SPAN
    const minute = Number(wallTime(new Date(start), place.timeZone).time.slice(3))
    const hours: Date[] = []
    for (let ms = start - (start % 60_000) + ((60 - minute) % 60) * 60_000; ms <= now + PATH_SPAN; ms += HOUR) {
      hours.push(new Date(ms))
    }
    const tracks = tracksAt([...times, ...hours], place.latitude, place.longitude)
    const nowAt = PATH_SPAN / PATH_STEP
    return PATH_BODIES.map((key) => {
      const track = tracks[key]
      const line = track.slice(0, times.length)
      return {
        key,
        past: pathData(line.slice(0, nowAt + 1), at),
        future: pathData(line.slice(nowAt), at),
        hours: track
          .slice(times.length)
          .map((p, i) => ({ ...p, hour: Number(wallTime(hours[i], place.timeZone).time.slice(0, 2)) }))
          .filter((p) => shown(p.alt)),
      }
    })
  }, [showPaths, dragging, utc, place.latitude, place.longitude, place.timeZone])
  const clipId = useId()
  const pick = chosen?.startsWith('hip') ? sky.stars.find((s) => `hip${s.hip}` === chosen) : sky.bodies.find((b) => b.key === chosen)
  // A star that has set, or is on the other half of the sky now, lets go
  useEffect(() => {
    if (chosen && !pick) setChosen(null)
  }, [chosen, pick])
  const pickName = pick && ('key' in pick ? t(pick.name) : t(pick.name!))
  const pickColour = pick && ('key' in pick ? BODY_COLOUR[pick.key] : starColour(pick.bv))
  const pickRadius = pick && ('key' in pick ? bodyRadius(pick) : starRadius(pick.mag))
  // Where the chosen one is on the map, if it is on this half of the sky
  const spot = pick && shown(pick.alt) ? at(pick.az, pick.alt) : null
  // The path picked out: the one hovered, else the chosen body's
  const pathFocus = focus ?? (chosen && PATH_BODIES.includes(chosen as SkyBody['key']) ? chosen : null)
  const focused = paths?.find((p) => p.key === pathFocus)
  const focusedBody = focused && sky.bodies.find((b) => b.key === focused.key)
  const focusedAt = focusedBody && shown(focusedBody.alt) ? at(focusedBody.az, focusedBody.alt) : null
  const up = sky.bodies.filter((b) => shown(b.alt))
  // The stars without a name, which are only looked at, as one path of dots per colour rather than
  // hundreds of elements: far less to redraw as the sky is dragged through time
  const starDots = useMemo(() => {
    const groups = new Map<string, string[]>()
    for (const st of sky.stars) {
      if (st.name) continue
      const [x, y] = at(st.az, st.alt)
      const r = starRadius(st.mag).toFixed(2)
      const dot = `M${(x - Number(r)).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${(2 * Number(r)).toFixed(2)} 0a${r} ${r} 0 1 0 -${(2 * Number(r)).toFixed(2)} 0`
      const colour = starColour(st.bv)
      const list = groups.get(colour)
      if (list) list.push(dot)
      else groups.set(colour, [dot])
    }
    return [...groups].map(([fill, dots]) => ({ fill, d: dots.join('') }))
    // at follows below, as sky does
  }, [sky])
  // Map units per screen pixel (the map is drawn 400 units square, fitted to its frame), so that
  // its text keeps its size on screen
  const k = frame && Math.min(frame.width, frame.height) > 100 ? Math.round((400 / Math.min(frame.width, frame.height)) * 100) / 100 : 1
  const labels = useMemo(
    () =>
      placeLabels([
        ...sky.bodies
          .filter((b) => shown(b.alt))
          .sort((a, b) => a.mag - b.mag)
          .map((b) => {
            const [x, y] = at(b.az, b.alt)
            return { key: b.key, text: t(b.name), x, y, r: bodyRadius(b), kind: 'body' as const }
          }),
        ...sky.stars
          .filter((st) => st.name)
          .map((st) => {
            const [x, y] = at(st.az, st.alt)
            return { key: `hip${st.hip}`, text: t(st.name!), x, y, r: starRadius(st.mag), kind: 'star' as const }
          }),
        // The best-known figures (rank 1–2) are named, where there is room
        ...figureViews
          .filter((c) => c.rank <= 2 && (below ? c.label.alt < -3 : c.label.alt > 3))
          .map((c) => {
            const [x, y] = at(c.label.az, c.label.alt)
            return { key: `fig${c.id}`, text: figureName(c), x, y, r: 0, kind: 'figure' as const }
          }),
      ], k),
    // t is new each render but changes only with the settings
    [sky, figureViews, language, script, below, k],
  )


  // Hover: a name tag over a body or named star, and a readout of where the pointer points, with
  // a faint altitude circle and azimuth line through it. Written straight into the page as the
  // pointer moves, without re-rendering the map.
  const svgRef = useRef<SVGSVGElement>(null)
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
    const m = e && svgRef.current?.getScreenCTM()
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

  // Drag the sky sideways to turn the time; a press that does not move is a click
  const drag = useRef<{ id: number; x: number; base: number; unit: number; moved: boolean } | null>(null)
  const dragged = useRef(false)
  const dragFrame = useRef(0)
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || !svgRef.current) return
    const box = svgRef.current.getBoundingClientRect()
    drag.current = { id: e.pointerId, x: e.clientX, base: utc.getTime(), unit: Math.min(box.width, box.height) / 400, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) {
      if (e.pointerType === 'mouse') pointAt(e)
      return
    }
    const dx = e.clientX - d.x
    if (!d.moved) {
      if (Math.abs(dx) < 6) return
      d.moved = true
      try {
        svgRef.current?.setPointerCapture(e.pointerId)
      } catch {
        // not a live pointer (a made-up event): the drag still works while it stays on the map
      }
      tipRef.current?.classList.remove('on')
      pointAt(null)
    }
    const minutes = Math.round((dx / d.unit) * DRAG_MINUTES)
    cancelAnimationFrame(dragFrame.current)
    dragFrame.current = requestAnimationFrame(() => {
      setDragShift(minutes)
      setPicked(wallTime(new Date(d.base + minutes * 60_000), place.timeZone))
    })
  }
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (!d.moved) return
    dragged.current = true
    // After the last step has landed
    requestAnimationFrame(() => requestAnimationFrame(() => setDragShift(null)))
  }
  const shiftLabel = (minutes: number) => {
    const h = Math.floor(Math.abs(minutes) / 60)
    const m = Math.abs(minutes) % 60
    const span = h && m ? t('{h} 小时 {m} 分', { h, m }) : h ? t('{h} 小时', { h }) : t('{m} 分', { m })
    return `${minutes < 0 ? '−' : '+'}${span}`
  }

  const lightNote = sky.light === 'day' ? t('太阳在地平线上，白天肉眼看不到星星，图中淡淡示意它们的位置。') : sky.light === 'twilight' ? t('晨昏蒙影中，只有最亮的星和行星可见。') : ''
  const map = (
    <svg
      ref={svgRef}
      className={`sky-map sky-${below ? 'below' : sky.light}${spot ? ' has-chosen' : ''}`}
      viewBox="0 0 400 400"
      style={{ '--k': k } as CSSProperties}
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
      <circle className="sky-disc" cx={C} cy={C} r={R} />
      {(
        [
          ['北', 'N', 0],
          ['东', 'E', 90],
          ['南', 'S', 180],
          ['西', 'W', 270],
        ] as const
      ).map(([label, labelEn, az]) => {
        const [x, y] = project(below ? (360 - az) % 360 : az, -9)
        return (
          <text key={label} className="sky-compass" x={x} y={y} textAnchor="middle" dominantBaseline="central">
            {en ? labelEn : label}
          </text>
        )
      })}

      <defs>
        <clipPath id={clipId}>
          <circle cx={C} cy={C} r={R} />
        </clipPath>
      </defs>
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
        {figureViews.length > 0 && (
          <g className={`sky-figures sky-figures-${figures}`} aria-hidden="true">
            {figureViews.map((c, i) => (
              // Serpens comes in two parts with the same id
              <path key={`${c.id}-${i}`} d={c.lines.map((l) => pathData(l, at)).join('')} />
            ))}
          </g>
        )}
        <g className="sky-stars">
          {starDots.map((g) => (
            <path key={g.fill} fill={g.fill} d={g.d} />
          ))}
          {sky.stars.filter((s) => s.name).map((s) => (
            <Star
              key={s.hip}
              star={s}
              tip={s.name && t('{name} · {direction} · 高 {altitude}°', { name: t(s.name), direction: azimuth(s.az), altitude: s.alt.toFixed(1) })}
              at={at}
              on={chosen === `hip${s.hip}`}
              chooseProps={chooseProps(`hip${s.hip}`)}
            />
          ))}
        </g>
        {paths && (
          <g className={`sky-paths${pathFocus ? ' has-focus' : ''}`} aria-hidden="true">
            {paths.map((p) => (
              <g key={p.key} className={`sky-path${pathFocus === p.key ? ' on' : ''}`} style={{ color: BODY_COLOUR[p.key] }}>
                <path className="past" d={p.past} />
                <path className="future" d={p.future} />
                {p.hours.map((h, i) => {
                  const [x, y] = at(h.az, h.alt)
                  // a 24-hour window has one hour twice
                  return <circle key={i} className="hour" cx={x} cy={y} r={1.6} />
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
                return <circle key={`${p.m}-${p.d}`} className="tick" cx={x} cy={y} r={1.8} />
              })}
              <circle className="start" cx={at(historyLine.start.az, historyLine.start.alt)[0]} cy={at(historyLine.start.az, historyLine.start.alt)[1]} r={3} />
            </g>
            <g className="sky-history-labels" aria-hidden="true">
              {historyLine.ticks
                .filter((p) => (below ? p.alt < 0 : p.alt > 0))
                .map((p) => {
                  const [x, y] = at(p.az, p.alt)
                  return (
                    <text key={`${p.m}-${p.d}`} x={x + 4} y={y + 3}>
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
                className={`sky-body sky-${b.key}${chosen === b.key ? ' on' : ''}`}
                aria-label={tip}
                data-tip={tip}
                {...chooseProps(b.key)}
                {...focusProps(b.key)}
              >
                <circle className="hit" cx={x} cy={y} r={Math.max(bodyRadius(b) + 3, 8)} />
                <circle cx={x} cy={y} r={bodyRadius(b)} fill={BODY_COLOUR[b.key]} opacity={b.key === 'moon' ? 0.4 + 0.6 * b.lit : 1} />
              </g>
            )
          })}
        </g>
        {focused && (
          <g className="sky-hour-labels" aria-hidden="true">
            {focused.hours.map((h, i) => {
              const [x, y] = at(h.az, h.alt)
              // None right on the body, where its name is
              if (focusedAt && Math.hypot(x - focusedAt[0], y - focusedAt[1]) < 14) return null
              return (
                <text key={i} x={x + 4} y={y - 4}>
                  {t('{h}时', { h: h.hour })}
                </text>
              )
            })}
          </g>
        )}
        <g className="sky-labels" aria-hidden="true">
          {labels.map((l) => {
            // The chosen one's name moves out past its ring
            const push = l.key === chosen && spot ? pickRadius! * 0.4 + 3 : 0
            return (
              <text
                key={l.key}
                className={
                  (l.kind === 'body' ? 'sky-body-name' : l.kind === 'figure' ? `sky-figure-name sky-figure-name-${figures}` : 'sky-star-name') +
                  (l.key === chosen ? ' on' : '')
                }
                x={l.anchor === 'start' ? l.x + push : l.anchor === 'end' ? l.x - push : l.x}
                y={l.anchor !== 'middle' || !spot ? l.y : l.y < spot[1] ? l.y - push : l.y + push}
                textAnchor={l.anchor}
                dominantBaseline="central"
                onClick={
                  l.kind === 'figure'
                    ? undefined
                    : (e) => {
                        e.stopPropagation()
                        choose(l.key)
                      }
                }
              >
                {l.text}
              </text>
            )
          })}
        </g>
      </g>
      {/* The ring round the chosen one: it closes in on it (keyed, so it does again for the next) and pulses */}
      {spot && (
        <g key={chosen} className="sky-chosen" style={{ color: pickColour }} aria-hidden="true">
          <circle cx={spot[0]} cy={spot[1]} r={pickRadius! * 1.4 + 4} />
          <circle className="pulse" cx={spot[0]} cy={spot[1]} r={pickRadius! * 1.4 + 4} />
        </g>
      )}
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

        {pick && (
          <div className="sky-chosen-info">
            <span className="sky-dot" style={{ background: pickColour }} />
            <strong>{pickName}</strong>
            <span className="muted">
              {azimuth(pick.az)} · {t('高 {altitude}°', { altitude: pick.alt.toFixed(1) })} · {t('星等 {mag}', { mag: pick.mag.toFixed(1) })}
            </span>
            <button type="button" className="ghost sky-unchoose" aria-label={t('取消选中')} title={t('取消选中')} onClick={() => setChosen(null)}>
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
            </tr>
          </thead>
          <tbody>
            {sky.bodies.map((b) => (
              <tr
                key={b.key}
                className={[b.alt < 0 && 'below', pathFocus === b.key && 'on', chosen === b.key && 'chosen'].filter(Boolean).join(' ') || undefined}
                {...focusProps(b.key)}
                tabIndex={0}
                aria-selected={chosen === b.key}
                onClick={() => choose(b.key)}
                onKeyDown={chooseKeys(b.key)}
              >
                <td>
                  <span className="sky-dot" style={{ background: BODY_COLOUR[b.key] }} />
                  {t(b.name)}
                </td>
                <td>{azimuth(b.az)}</td>
                <td>{b.alt < 0 ? t('地平线下') : `${b.alt.toFixed(1)}°`}</td>
                <td>{b.mag.toFixed(1)}</td>
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
          {t('点一下天体、有名字的亮星或表格里的一行可把它圈出，再点一次、点空白处或按 Esc 取消；左右拖动星空可以转动时间。')}
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
        </p>
      </aside>

      {createPortal(
        <div
          className={`sky-backdrop${dragging ? ' dragging' : ''}`}
          style={frame ? { left: frame.left, top: frame.top, width: frame.width, height: frame.height } : { visibility: 'hidden' }}
        >
          {map}
          <div className="sky-tip" ref={tipRef} aria-hidden="true" />
          {dragging ? (
            <div className="sky-drag-chip" aria-live="polite">
              {wall.date} {wall.time} · {shiftLabel(dragShift)}
            </div>
          ) : (
            <>
              <div className="sky-readout" ref={readoutRef} aria-hidden="true" />
              <div className="sky-drag-hint" aria-hidden="true">
                {t('⟷ 左右拖动星空，转动时间')}
              </div>
            </>
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
  on,
  chooseProps,
}: {
  star: SkyStar
  /** Its name, direction and altitude, for a named star */
  tip?: string
  /** The map's projection (it depends on which half of the sky is shown) */
  at: (az: number, alt: number) => [number, number]
  /** Whether it is the chosen one */
  on: boolean
  /** To choose it */
  chooseProps: React.SVGProps<SVGGElement>
}) {
  const [x, y] = at(s.az, s.alt)
  const r = starRadius(s.mag)
  return (
    <g className={`sky-star${on ? ' on' : ''}`} aria-label={tip} data-tip={tip} {...chooseProps}>
      <circle className="hit" cx={x} cy={y} r={Math.max(r + 3, 6)} />
      <circle cx={x} cy={y} r={r} fill={starColour(s.bv)} />
    </g>
  )
}
