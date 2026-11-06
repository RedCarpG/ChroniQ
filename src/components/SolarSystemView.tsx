import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SIGN_ELEMENT, SIGN_GLYPHS, SIGNS } from '../lib/astrology'
import { enDate } from '../lib/calendar'
import { zodiacStars } from '../lib/eclipticStars'
import { PLANETS, lightTime, orbits, planetsAt, retroSpans, seenTrail, type PlanetKey, type PlanetPosition } from '../lib/solarSystem'
import { usePick } from './usePick'
import { useSettings, useT } from '../settingsContext'
import { DateParts } from './BirthForm'
import { TitleMark } from './Logo'
import { BODY_COLOUR } from './bodyColours'
import { Immersive, useNarrow, type Frame } from './Immersive'

const C = 200
const R = 180
const DAY = 86400000
/** The zodiac round the map: the signs and the real stars along the ecliptic, as far off as the stars are */
const R_Z1 = 193
const R_Z2 = 211
const R_ZMID = (R_Z1 + R_Z2) / 2
/** A point at an ecliptic longitude (counter-clockwise from ♈ 0°, to the right) and a radius */
const polar = (lon: number, r: number): [number, number] => [
  C + r * Math.cos((lon * Math.PI) / 180),
  C - r * Math.sin((lon * Math.PI) / 180),
]
/** The ring of a sign, from one longitude to another (counter-clockwise on screen) */
const sector = (from: number, to: number) => {
  const [a, b, c, d] = [polar(from, R_Z2), polar(to, R_Z2), polar(to, R_Z1), polar(from, R_Z1)]
  return `M${a}A${R_Z2} ${R_Z2} 0 0 0 ${b}L${c}A${R_Z1} ${R_Z1} 0 0 1 ${d}Z`
}
/** 白羊 12° */
const signDeg = (lon: number) => [SIGNS[Math.floor((((lon % 360) + 360) % 360) / 30)], Math.floor((((lon % 360) + 360) % 360) % 30)] as const

/**
 * How far out the map reaches (AU at its rim), from inside Venus's orbit to past Pluto's. Distances
 * are true to scale out to about Mars; further out they are drawn by a power below one, down to the
 * square root for the whole system, so the inner planets still show beside the outer ones.
 */
export const REACH_MIN = 0.5
export const REACH_MAX = 50
const REACH_START = 1.75
const powerFor = (reach: number) => 1 - 0.5 * Math.max(0, Math.min(1, Math.log(reach / 2) / Math.log(40 / 2)))
/** The map's radius for a distance from the Sun (AU) */
export const radiusAt = (au: number, reach: number) => R * Math.pow(au / reach, powerFor(reach))
const GRID = [0.25, 0.5, 1, 1.5, 2, 3, 5, 10, 20, 30, 40, 50]

/** Days of simulated time per second of playback */
const SPEEDS = [1, 7, 30, 365]

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 太阳系: the planets on their orbits, seen from above the ecliptic (north up out of the page, so they
 * all go round counter-clockwise), at now or at a picked date, with playback to watch them move. The
 * map is drawn over the whole screen (Immersive); the wheel, a pinch or the buttons zoom it from the
 * inner planets out to Pluto, and a drag across moves the date.
 */
export function SolarSystemView() {
  const t = useT()
  const { language } = useSettings()
  const en = language === 'en'
  const narrow = useNarrow()
  const speedLabel: Record<number, string> = { 1: t('1 天/秒'), 7: t('1 周/秒'), 30: t('1 月/秒'), 365: t('1 年/秒') }
  const [time, setTime] = useState(() => Date.now())
  const [live, setLive] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(7)
  const [reach, setReach] = useState(REACH_START)
  const zoomTo = (r: number) => setReach(Math.max(REACH_MIN, Math.min(REACH_MAX, r)))
  // The planet picked out: hovered, or chosen (a click; a click on empty space lets go). A chosen
  // one keeps Earth's line of sight to it and its trail among the stars, also while playing.
  const pick = usePick<PlanetKey>()
  const focus = pick.active

  // Following now: refresh once a minute
  useEffect(() => {
    if (!live) return
    // Not while the tab is hidden; catch up when it is shown again
    const tick = () => !document.hidden && setTime(Date.now())
    const id = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [live])
  // Playback: advance the date every frame
  const last = useRef(0)
  useEffect(() => {
    if (!playing) return
    let raf = 0
    last.current = performance.now()
    const step = (now: number) => {
      const dt = (now - last.current) / 1000
      last.current = now
      setTime((t) => Math.min(t + dt * speed * DAY, Date.UTC(2100, 11, 31)))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed])
  const goTo = (ms: number) => {
    setLive(false)
    setTime(Math.max(Date.UTC(1900, 0, 1), Math.min(Date.UTC(2100, 11, 31), ms)))
  }

  const planets = useMemo(() => planetsAt(new Date(time)), [time])
  // Orbits barely change over a lifetime: one set, sampled once, from the moment the page opened
  const [t0] = useState(Date.now)
  const paths = useMemo(() => orbits(new Date(t0)), [t0])
  // The zodiac's stars move on by precession: made again only for another decade
  const decade = Math.round(new Date(time).getUTCFullYear() / 10) * 10
  const zodiac = useMemo(() => {
    const sizes = new Map<number, string>()
    for (const st of zodiacStars(decade, 9)) {
      const [x, y] = polar(st.lon, R_ZMID + st.lat * 0.95)
      const w = Math.round(Math.max(0.7, 2.4 - 0.36 * st.mag) * 2) / 2
      sizes.set(w, (sizes.get(w) ?? '') + `M${x.toFixed(1)} ${y.toFixed(1)}h.01`)
    }
    return [...sizes]
  }, [decade])
  const xy = (x: number, y: number): [number, number] => {
    const d = Math.hypot(x, y)
    const k = d ? radiusAt(d, reach) / d : 0
    return [C + x * k, C - y * k]
  }
  // The orbits' outlines only change with the zoom, not with the date (which playback moves every frame)
  const orbitPoints = useMemo(
    () => Object.fromEntries(Object.entries(paths).map(([key, pts]) => [key, pts.map(([x, y]) => xy(x, y).join(',')).join(' ')])),
    // xy follows the zoom
    [paths, reach],
  )
  /** Where an off-map planet's direction meets the rim */
  const rim = (p: PlanetPosition): [number, number] => {
    const a = Math.atan2(p.y, p.x)
    return [C + (R + 8) * Math.cos(a), C - (R + 8) * Math.sin(a)]
  }
  const inside = (p: PlanetPosition) => p.sun <= reach * 1.02
  const shown = planets.filter(inside)
  const beyond = planets.filter((p) => !inside(p))
  const orbitShown = PLANETS.filter((p) => {
    const at = planets.find((q) => q.key === p.key)!
    return inside(at)
  })
  const earth = planets.find((p) => p.key === 'earth')!
  const date = new Date(time)
  const ymd = { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
  const dateText = (d: Date) =>
    en ? enDate(d.getFullYear(), d.getMonth() + 1, d.getDate(), { day: 'numeric', month: 'short', year: 'numeric' }) : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  const size = (p: PlanetPosition) => (p.key === 'jupiter' || p.key === 'saturn' ? 5.5 : 4.2)
  /** Where it stands among the stars seen from Earth, as in the 星盘 (for Earth, where the Sun does) */
  const seenText = (p: PlanetPosition) => {
    const [sign, deg] = signDeg(p.geo)
    const where = t('{sign} {deg}°', { sign: t(sign), deg })
    return p.key === 'earth' ? t('从地球看，太阳在{where}', { where }) : t('从地球看，在{where}', { where })
  }
  const hover = (key: PlanetKey) => ({ tabIndex: 0, ...pick.props(key) })
  const focused = planets.find((p) => p.key === focus)
  // The chosen planet's way among the stars over the time before (as far back as about ten seconds
  // of playing at the current speed, at least two months): dots on the zodiac ring, fading into the
  // past, which double back while it is retrograde
  const trailSpan = Math.max(60, speed * 10) * DAY
  const seen = useMemo(() => {
    if (!pick.picked) return []
    const times = Array.from({ length: 48 }, (_, i) => new Date(time - ((47 - i) / 47) * trailSpan))
    return seenTrail(pick.picked, times)
  }, [pick.picked, time, trailSpan])
  // A short trail behind each planet, along its orbit: the way it is going
  const trail = (p: PlanetPosition) => {
    const pts = paths[p.key]
    const n = pts.length
    const period = PLANETS.find((x) => x.key === p.key)!.period
    const at = Math.floor(((((time - t0) / (period * DAY)) % 1) + 1) % 1 * n)
    const back = Array.from({ length: 11 }, (_, k) => xy(...pts[(((at - k) % n) + n) % n]).join(','))
    return [`${xy(p.x, p.y).join(',')} ${back.slice(0, 4).join(' ')}`, back.slice(3, 7).join(' '), back.slice(6).join(' ')]
  }
  // The year of the date, along the bottom; the chosen planet's times of going backwards marked on it
  const year = date.getFullYear()
  const yearStart = new Date(year, 0, 1).getTime()
  const yearEnd = new Date(year + 1, 0, 1).getTime()
  const yearRetro = useMemo(
    () => (pick.picked && pick.picked !== 'earth' ? retroSpans(pick.picked, new Date(yearStart), new Date(yearEnd)) : []),
    [pick.picked, yearStart, yearEnd],
  )
  // The chosen planet's own time of going backwards: the one it is in, or the next (within a year and a half)
  const dayKey = Math.floor(time / DAY)
  const nearRetro = useMemo(() => {
    if (!pick.picked || pick.picked === 'earth') return null
    const spans = retroSpans(pick.picked, new Date(dayKey * DAY - 300 * DAY), new Date(dayKey * DAY + 540 * DAY))
    return spans.find((s) => s.end.getTime() >= dayKey * DAY && s.start.getTime() > dayKey * DAY - 300 * DAY + DAY) ?? null
  }, [pick.picked, dayKey])

  // 浮现: the orbits draw themselves round the Sun and the planets come out on them, on opening the
  // page; only backwards-filled, so nothing is left in effect after
  const orreryRef = useRef<SVGSVGElement>(null)
  useLayoutEffect(() => {
    const svg = orreryRef.current
    if (!svg?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    svg.querySelectorAll('.orrery-orbit').forEach((el, i) =>
      el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1200, delay: i * 90, easing: 'ease-out', fill: 'backwards' }),
    )
    svg.querySelectorAll('.orrery-planet, .orrery-beyond').forEach((el, i) =>
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 500 + i * 90, fill: 'backwards' }),
    )
    svg.querySelector('.orrery-zodiac')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1400, fill: 'backwards' })
  }, [])

  // Taking the map in hand: a drag across moves the date (more days a pixel the further out it
  // reaches), two fingers pinch, the wheel zooms. A drag is not a click: it neither picks nor lets go
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ x: number; reach: number; dist?: number; moved: boolean } | null>(null)
  const perPx = Math.max(1, Math.min(30, reach / 1.2)) * DAY
  const gestures = {
    onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const pts = [...pointers.current.values()]
      gesture.current = { x: e.clientX, reach, moved: false, dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined }
    },
    onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => {
      const g = gesture.current
      if (!g || !pointers.current.has(e.pointerId)) return
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const pts = [...pointers.current.values()]
      if (pts.length === 2 && g.dist) {
        g.moved = true
        zoomTo((g.reach * g.dist) / Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)))
        return
      }
      const dx = e.clientX - g.x
      if (!g.moved && Math.abs(dx) < 5) return
      if (!g.moved) {
        g.moved = true
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // not a live pointer
        }
      }
      g.x = e.clientX
      setPlaying(false)
      goTo(time + dx * perPx)
    },
    onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => {
      pointers.current.delete(e.pointerId)
      if (pointers.current.size === 0 && !gesture.current?.moved) gesture.current = null
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (gesture.current?.moved) e.stopPropagation()
      gesture.current = null
    },
    onWheel: (e: React.WheelEvent<SVGSVGElement>) => zoomTo(reach * Math.exp(e.deltaY * 0.0015)),
  }

  const sunR = 6 + 3 * Math.max(0, (powerFor(reach) - 0.5) / 0.5)
  const gridAU = GRID.filter((au) => au < reach * 0.98 && au >= reach / 6)
  let lastLabel = -Infinity
  const grid = gridAU.map((au) => {
    const r = radiusAt(au, reach)
    const label = r - lastLabel > 16 && r > 14
    if (label) lastLabel = r
    return { au, r, label }
  })

  const map = (frame: Frame) => {
    const side = Math.max(120, Math.min(frame.width, frame.height))
    return (
      <div className="solar-sky">
        <SpaceStars />
        <svg
          ref={orreryRef}
          className={`orrery${focus ? ' has-focus' : ''}`}
          viewBox="-18 -18 436 436"
          role="img"
          aria-label={t('太阳系行星位置')}
          style={{ left: frame.left + (frame.width - side) / 2, top: frame.top + (frame.height - side) / 2, width: side, height: side }}
          {...gestures}
          onPointerCancel={gestures.onPointerUp}
        >
          <defs>
            <radialGradient id="orrery-sun-core">
              <stop offset="0" stopColor="#fffbea" />
              <stop offset="0.55" stopColor="#ffd34d" />
              <stop offset="1" stopColor="#ff9d2e" />
            </radialGradient>
            <radialGradient id="orrery-sun-glow">
              <stop offset="0" stopColor="#ffcf4a" stopOpacity="0.5" />
              <stop offset="0.35" stopColor="#ff9d2e" stopOpacity="0.16" />
              <stop offset="1" stopColor="#ff9d2e" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="orrery-space">
              <stop offset="0" stopColor="#0d1326" stopOpacity="0.85" />
              <stop offset="0.82" stopColor="#0b1022" stopOpacity="0.55" />
              <stop offset="1" stopColor="#0b1022" stopOpacity="0" />
            </radialGradient>
            {PLANETS.map((p) => (
              <radialGradient key={p.key} id={`orrery-glow-${p.key}`}>
                <stop offset="0" stopColor={BODY_COLOUR[p.key]} stopOpacity="0.45" />
                <stop offset="1" stopColor={BODY_COLOUR[p.key]} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>
          <circle className="orrery-bg" cx={C} cy={C} r={R_Z2 + 14} fill="url(#orrery-space)" />
          {/* The zodiac: where each planet stands among the stars, seen from Earth, is marked on it */}
          <g className="orrery-zodiac">
            {SIGNS.map((name, i) => {
              const [gx, gy] = polar(i * 30 + 15, R_ZMID)
              const on = focused && Math.floor(focused.geo / 30) === i
              return (
                <g key={name} className={`orrery-sign ${SIGN_ELEMENT[i]}${on ? ' on' : ''}`}>
                  <path d={sector(i * 30, i * 30 + 30)} />
                  <text x={gx} y={gy} textAnchor="middle" dominantBaseline="central">
                    {SIGN_GLYPHS[i]}
                  </text>
                </g>
              )
            })}
            {zodiac.map(([w, d]) => (
              <path key={w} className="orrery-zodiac-stars" d={d} strokeWidth={w} />
            ))}
            {seen.map((lon, i) => {
              const [x, y] = polar(lon, (R_Z1 + R_Z2) / 2)
              return <circle key={i} className="orrery-seen-dot" cx={x} cy={y} r={1.2 + (i / seen.length) * 1.3} opacity={0.15 + (0.75 * i) / seen.length} fill={pick.picked === 'earth' ? '#ffcf4a' : BODY_COLOUR[pick.picked!]} />
            })}
            {focused && (
              <line
                className="orrery-seen"
                x1={polar(focused.geo, R_Z1 - 4)[0]}
                y1={polar(focused.geo, R_Z1 - 4)[1]}
                x2={polar(focused.geo, R_Z2 + 4)[0]}
                y2={polar(focused.geo, R_Z2 + 4)[1]}
                stroke={focused.key === 'earth' ? '#ffcf4a' : BODY_COLOUR[focused.key]}
              />
            )}
          </g>
          {grid.map(({ au, r, label }) => (
            <g key={au}>
              <circle className="orrery-grid" cx={C} cy={C} r={r} />
              {label && (
                <text className="orrery-au" x={C + 3} y={C - r - 3}>
                  {au} AU
                </text>
              )}
            </g>
          ))}
          <text className="orrery-equinox" x={394} y={C + 14} textAnchor="end">
            {t('♈︎ 春分点 →')}
          </text>
          {orbitShown.map((p) => (
            <polygon
              key={p.key}
              className={`orrery-orbit${focus === p.key ? ' on' : ''}`}
              points={orbitPoints[p.key]}
              stroke={BODY_COLOUR[p.key]}
              pathLength={1}
            />
          ))}
          <circle cx={C} cy={C} r={sunR * 4.9} fill="url(#orrery-sun-glow)" />
          <circle className="orrery-sun" cx={C} cy={C} r={sunR} fill="url(#orrery-sun-core)" />
          {/* Trails behind the planets, fading */}
          {shown.map((p) => (
            <g key={p.key} className="orrery-trail" stroke={BODY_COLOUR[p.key]}>
              {trail(p).map((pts, i) => (
                <polyline key={i} points={pts} className={`t${i}`} />
              ))}
            </g>
          ))}
          {/* Earth's line of sight to the hovered planet (to its rim mark when off the map) */}
          {focused && focused.key !== 'earth' && focused.retrograde && (
            <text
              className="orrery-retro"
              x={(xy(earth.x, earth.y)[0] + (shown.includes(focused) ? xy(focused.x, focused.y)[0] : rim(focused)[0])) / 2}
              y={(xy(earth.x, earth.y)[1] + (shown.includes(focused) ? xy(focused.x, focused.y)[1] : rim(focused)[1])) / 2 - 6}
              textAnchor="middle"
            >
              {t('逆行')}
            </text>
          )}
          {focused?.key === 'earth' && (
            // From Earth the Sun is what it sees on the zodiac (as the table's Earth row): its line of
            // sight runs through the Sun to the zodiac, and a chosen Earth's trail is the Sun's way through the year
            <line className="orrery-sight sun" x1={xy(earth.x, earth.y)[0]} y1={xy(earth.x, earth.y)[1]} x2={polar(focused.geo, R_Z1 - 4)[0]} y2={polar(focused.geo, R_Z1 - 4)[1]} />
          )}
          {focused && focused.key !== 'earth' && (
            <line
              className={`orrery-sight${focused.retrograde ? ' retro' : ''}`}
              x1={xy(earth.x, earth.y)[0]}
              y1={xy(earth.x, earth.y)[1]}
              x2={shown.includes(focused) ? xy(focused.x, focused.y)[0] : rim(focused)[0]}
              y2={shown.includes(focused) ? xy(focused.x, focused.y)[1] : rim(focused)[1]}
            />
          )}
          {/* …and on past it, fading: the way one looks from Earth to see it among the stars */}
          {focused && focused.key !== 'earth' && shown.includes(focused) && (() => {
            const [ex, ey] = xy(earth.x, earth.y)
            const [px, py] = xy(focused.x, focused.y)
            const d = Math.hypot(px - ex, py - ey) || 1
            const len = Math.max(40, Math.min(110, R - Math.hypot(px - C, py - C)))
            const [qx, qy] = [px + ((px - ex) / d) * len, py + ((py - ey) / d) * len]
            return (
              <>
                <linearGradient id="orrery-ray" gradientUnits="userSpaceOnUse" x1={px} y1={py} x2={qx} y2={qy}>
                  <stop offset="0" stopColor={focused.retrograde ? '#ff7a6b' : '#ffffff'} stopOpacity="0.8" />
                  <stop offset="1" stopColor={focused.retrograde ? '#ff7a6b' : '#ffffff'} stopOpacity="0" />
                </linearGradient>
                <line className="orrery-ray" x1={px} y1={py} x2={qx} y2={qy} stroke="url(#orrery-ray)" />
              </>
            )
          })()}
          {shown.map((p) => {
            const [x, y] = xy(p.x, p.y)
            // Crowding the Sun when the map reaches far out, only Earth keeps its name
            const named = p.key === 'earth' || focus === p.key || radiusAt(p.sun, reach) > 22
            return (
              <g key={p.key} className={`orrery-planet pl-${p.key}${focus === p.key ? ' on' : ''}`} {...hover(p.key)}>
                <title>
                  {t('{name} · 距太阳 {sun} AU', { name: t(p.name), sun: p.sun.toFixed(2) })}
                  {p.key !== 'earth' && ` · ${t('距地球 {earth} AU', { earth: p.earth.toFixed(2) })}`}
                  {` · ${seenText(p)}`}
                </title>
                <circle cx={x} cy={y} r={11} className="orrery-hit" />
                <circle cx={x} cy={y} r={12} fill={`url(#orrery-glow-${p.key})`} className="orrery-glow" />
                <circle cx={x} cy={y} r={size(p)} fill={BODY_COLOUR[p.key]} />
                {/* Seen from above, each is lit on the side toward the Sun */}
                <path
                  className="orrery-night"
                  d={`M0 ${-size(p)}A${size(p)} ${size(p)} 0 0 1 0 ${size(p)}Z`}
                  transform={`translate(${x} ${y}) rotate(${(-p.lon).toFixed(1)})`}
                />
                {p.key === 'saturn' && <ellipse cx={x} cy={y} rx={9} ry={3} className="orrery-ring" />}
                {named && (
                  <text x={x} y={y - 9} textAnchor="middle" className="orrery-name">
                    {t(p.name)}
                  </text>
                )}
              </g>
            )
          })}
          {/* The planets past the rim: a mark on it in their direction */}
          {beyond.map((p) => {
            const [x, y] = rim(p)
            return (
              <g key={p.key} className={`orrery-beyond${focus === p.key ? ' on' : ''}`} {...hover(p.key)}>
                <title>
                  {t('{name}在这个方向，距太阳 {sun} AU', { name: t(p.name), sun: p.sun.toFixed(1) })}
                  {` · ${seenText(p)}`}
                </title>
                <circle cx={x} cy={y} r={3} fill={BODY_COLOUR[p.key]} />
                <text
                  x={C + (x - C) * 0.93}
                  y={C + (y - C) * 0.93}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="orrery-beyond-name"
                >
                  {t(p.name).slice(0, 1)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  const toolbar = (
    <div className="imm-glass solar-bar">
      <h3 className="section-title">
        <TitleMark />
        {t('太阳系')}
      </h3>
      <DateParts
        label={t('日期')}
        value={ymd}
        onChange={(d) => {
          const keep = new Date(time)
          goTo(new Date(d.year, d.month - 1, d.day, keep.getHours(), keep.getMinutes()).getTime())
        }}
      />
      <span className="solar-clock">
        {pad(date.getHours())}:{pad(date.getMinutes())}
      </span>
      <button
        type="button"
        className={`ghost toggle${live && !playing ? ' on' : ''}`}
        aria-pressed={live && !playing}
        onClick={() => {
          setPlaying(false)
          setLive(true)
          setTime(Date.now())
        }}
      >
        {t('现在')}
      </button>
    </div>
  )

  const overlay = (
    <>
      <div className="imm-zoom" role="group" aria-label={t('缩放')}>
        <button type="button" onClick={() => zoomTo(reach / 1.6)} disabled={reach <= REACH_MIN * 1.001} aria-label={t('放大')} title={t('放大')}>
          +
        </button>
        <button type="button" onClick={() => zoomTo(reach * 1.6)} disabled={reach >= REACH_MAX * 0.999} aria-label={t('缩小')} title={t('缩小')}>
          −
        </button>
        <button type="button" onClick={() => setReach(REACH_START)} disabled={reach === REACH_START} aria-label={t('复原')} title={t('复原')}>
          ⟲
        </button>
      </div>
      <p className="imm-hint">
        {t('视野 {au} AU', { au: reach < 10 ? reach.toFixed(2) : reach.toFixed(0) })} · {t('拖动画面改日期 · 滚轮或双指缩放 · 点行星看它的视线')}
      </p>
    </>
  )

  const play = (
    <div className={narrow ? 'solar-play' : 'imm-glass solar-play'}>
      <button
        type="button"
        className={`solar-play-button${playing ? ' on' : ''}`}
        aria-pressed={playing}
        onClick={() => {
          setLive(false)
          setPlaying((p) => !p)
        }}
      >
        {playing ? t('❚❚ 暂停') : t('▶ 播放')}
      </button>
      {narrow ? (
        <select aria-label={t('播放速度')} value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          {SPEEDS.map((days) => (
            <option key={days} value={days}>
              {speedLabel[days]}
            </option>
          ))}
        </select>
      ) : (
        <div className="seg small" role="group" aria-label={t('播放速度')}>
          {SPEEDS.map((days) => (
            <button key={days} type="button" className={speed === days ? 'on' : undefined} aria-pressed={speed === days} onClick={() => setSpeed(days)}>
              {speedLabel[days]}
            </button>
          ))}
        </div>
      )}
      <div className="solar-year">
        <div className="solar-track">
          {yearRetro.map((s) => (
            <span
              key={s.start.getTime()}
              className="solar-retro"
              style={{
                left: `${((s.start.getTime() - yearStart) / (yearEnd - yearStart)) * 100}%`,
                width: `${Math.max(0.6, ((s.end.getTime() - s.start.getTime()) / (yearEnd - yearStart)) * 100)}%`,
              }}
            />
          ))}
          <input
            type="range"
            min={yearStart}
            max={yearEnd - DAY}
            step={DAY / 4}
            value={Math.min(time, yearEnd - DAY)}
            aria-label={t('日期')}
            aria-valuetext={dateText(date)}
            onChange={(e) => {
              setPlaying(false)
              goTo(Number(e.target.value))
            }}
          />
        </div>
        <div className="solar-months" aria-hidden="true">
          <span>{en ? year : `${year}年`}</span>
          {!narrow && [4, 7, 10].map((m) => <span key={m}>{en ? enDate(year, m, 1, { month: 'short' }) : `${m}月`}</span>)}
          {pick.picked && yearRetro.length > 0 && <span className="solar-retro-key">{t('{name}逆行', { name: t(PLANETS.find((p) => p.key === pick.picked)!.name) })}</span>}
          <span>{en ? year + 1 : `${year + 1}年`}</span>
        </div>
      </div>
    </div>
  )

  const chosen = pick.picked ? planets.find((p) => p.key === pick.picked)! : null
  const card = chosen ? (
    <div className="solar-card">
      <div className="solar-card-head">
        <span className="sky-dot" style={{ background: BODY_COLOUR[chosen.key] }} />
        <strong>{t(chosen.name)}</strong>
        {chosen.key !== 'earth' && <span className={chosen.retrograde ? 'retro' : 'muted'}>{chosen.retrograde ? t('逆行中') : t('顺行')}</span>}
      </div>
      <p>
        {seenText(chosen)}
        {chosen.key !== 'earth' && ` · ${t('距地球 {earth} AU', { earth: chosen.earth.toFixed(2) })} · ${t('光行时 {t}', { t: lightTime(chosen.earth, language) })}`}
      </p>
      {nearRetro && (
        <p className="muted">
          {nearRetro.start.getTime() <= time
            ? t('{from} 起逆行，约 {to} 转顺行', { from: dateText(nearRetro.start), to: dateText(nearRetro.end) })
            : t('下次逆行：{from} 至 {to}', { from: dateText(nearRetro.start), to: dateText(nearRetro.end) })}
        </p>
      )}
    </div>
  ) : (
    <p className="muted row-note solar-pick-hint">{t('点一颗行星（或下表的一行），看地球到它的视线，以及它在星座间来回的路径。')}</p>
  )

  const panel = (
    <>
      {card}
      <p className="muted row-note">
        {dateText(date)} {pad(date.getHours())}:{pad(date.getMinutes())}
        {live && !playing ? t('（随时间更新）') : ''}
        {' · '}
        {t('从黄道北极俯视，行星都沿逆时针方向公转；右方是春分点方向（黄经 0°）。')}
        {en && ' '}
        {powerFor(reach) > 0.99 ? t('距离按真实比例。') : t('为了让内行星也看得见，远处的距离按比例压缩。')}
      </p>
      <table className="star-table sky-table orrery-table">
        <thead>
          <tr>
            <th>{t('行星')}</th>
            <th>{t('距太阳')}</th>
            <th>{t('距地球')}</th>
            <th className="orrery-light">{t('光行时')}</th>
            <th>{t('所在星座')}</th>
            <th>{t('视运动')}</th>
          </tr>
        </thead>
        <tbody>
          {planets.map((p) => (
            <PlanetRow key={p.key} p={p} on={focus === p.key} hover={hover(p.key)} />
          ))}
        </tbody>
      </table>
      <p className="muted row-note">
        {t('距离以天文单位（AU，日地平均距离约 1.5 亿千米）计；光行时是行星的光到达地球所需的时间。「逆行」是从地球看行星在星座间倒退， 其实是地球在内圈超过外行星（或内行星从地球与太阳之间经过）造成的视觉效果：悬停行星可看地球到它的视线。行星位置由 astronomy-engine 计算。')}
      </p>
    </>
  )

  const retroNow = planets.filter((p) => p.retrograde && p.key !== 'earth')
  const summary = chosen
    ? `${t(chosen.name)} · ${chosen.key !== 'earth' ? `${chosen.retrograde ? t('逆行中') : t('顺行')} · ` : ''}${seenText(chosen)}`
    : `${dateText(date)} · ${retroNow.length ? t('{n} 颗行星逆行', { n: retroNow.length }) : t('没有行星逆行')}`

  return (
    <Immersive name="solar-page" backdrop={map} toolbar={toolbar} overlay={overlay} panelTitle={t('行星')} panel={panel} summary={summary} bottom={play} />
  )
}

/**
 * Deep space behind the map: stars scattered by a fixed seed (the same every time), a faint band of
 * the Milky Way across. Drawn again only when the window changes size.
 */
function SpaceStars() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const draw = () => {
      const canvas = ref.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const bg = ctx.createRadialGradient(w * 0.45, h * 0.5, 0, w * 0.45, h * 0.5, Math.max(w, h) * 0.75)
      bg.addColorStop(0, '#111830')
      bg.addColorStop(0.55, '#0a0f20')
      bg.addColorStop(1, '#04060d')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      // The Milky Way: a soft band from the upper left down to the lower right
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.rotate(0.42)
      const band = ctx.createLinearGradient(0, -h * 0.22, 0, h * 0.22)
      band.addColorStop(0, 'rgba(139,131,197,0)')
      band.addColorStop(0.5, 'rgba(170,160,220,0.09)')
      band.addColorStop(1, 'rgba(139,131,197,0)')
      ctx.fillStyle = band
      ctx.fillRect(-w, -h * 0.22, w * 2, h * 0.44)
      ctx.restore()
      let seed = 23
      const rnd = () => {
        seed = (seed * 16807) % 2147483647
        return seed / 2147483647
      }
      const count = Math.round((w * h) / 2600)
      for (let i = 0; i < count; i++) {
        const x = rnd() * w
        const y = rnd() * h
        const r = 0.3 + rnd() ** 4 * 1.5
        ctx.globalAlpha = 0.12 + rnd() ** 2 * 0.7
        ctx.fillStyle = rnd() < 0.15 ? '#ffe2bd' : rnd() < 0.3 ? '#c8d6ff' : '#f4efe2'
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])
  return <canvas ref={ref} className="space-stars" aria-hidden="true" />
}

function PlanetRow({ p, on, hover }: { p: PlanetPosition; on: boolean; hover: Record<string, unknown> }) {
  const t = useT()
  const { language } = useSettings()
  return (
    <tr className={on ? 'on' : undefined} {...hover}>
      <td>
        <span className="sky-dot" style={{ background: BODY_COLOUR[p.key] }} />
        {t(p.name)}
      </td>
      <td>{p.sun.toFixed(2)} AU</td>
      <td>{p.key === 'earth' ? '—' : `${p.earth.toFixed(2)} AU`}</td>
      <td className="orrery-light">{p.key === 'earth' ? '—' : lightTime(p.earth, language)}</td>
      <td title={p.key === 'earth' ? t('从地球看太阳所在的星座') : t('从地球看它所在的星座，与星盘相同')}>
        {p.key === 'earth' && '☉ '}
        <span className="sign-full">{t('{sign} {deg}°', { sign: t(signDeg(p.geo)[0]), deg: signDeg(p.geo)[1] })}</span>
        <span className="sign-short">
          {SIGN_GLYPHS[SIGNS.indexOf(signDeg(p.geo)[0])]}
          {signDeg(p.geo)[1]}°
        </span>
      </td>
      <td className={p.retrograde ? 'retro' : undefined}>{p.key === 'earth' ? '—' : p.retrograde ? t('逆行') : t('顺行')}</td>
    </tr>
  )
}
