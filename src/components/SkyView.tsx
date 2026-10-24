import { useEffect, useId, useMemo, useState } from 'react'
import { toUtc, type StarPlace } from '../lib/astrology'
import { PATH_BODIES, formatAzimuth, skyAt, tracksAt, type SkyBody, type SkyStar } from '../lib/sky'
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

interface Label {
  key: string
  text: string
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
  kind: 'body' | 'star'
}

/**
 * Places names beside their points without overlapping: each tries right,
 * left, above and below its point, and takes the first spot that is free.
 * Bodies go first (brightest first), then named stars; a star name with no
 * free spot is left off.
 */
function placeLabels(points: { key: string; text: string; x: number; y: number; r: number; kind: Label['kind'] }[]) {
  const boxes: [number, number, number, number][] = []
  const labels: Label[] = []
  for (const p of points) {
    const size = p.kind === 'body' ? 10 : 8.5
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
    if (!spot && p.kind === 'star') continue
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

/** SVG path data through the projected points */
const pathData = (points: { az: number; alt: number }[]) =>
  points.map((p, i) => `${i ? 'L' : 'M'}${project(p.az, p.alt).map((v) => v.toFixed(1)).join(' ')}`).join('')

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month, day }
}

/** Wall-clock date and time of an instant in a time zone, as the inputs want them */
function wallTime(d: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
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
export function SkyView({ place }: { place: StarPlace }) {
  const t = useT()
  const { language } = useSettings()
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
  const sky = useMemo(() => skyAt(utc, place.latitude, place.longitude), [utc, place.latitude, place.longitude])

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
  const paths = useMemo(() => {
    if (!showPaths) return null
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
        past: pathData(line.slice(0, nowAt + 1)),
        future: pathData(line.slice(nowAt)),
        hours: track
          .slice(times.length)
          .map((p, i) => ({ ...p, hour: Number(wallTime(hours[i], place.timeZone).time.slice(0, 2)) }))
          .filter((p) => p.alt >= 0),
      }
    })
  }, [showPaths, utc, place.latitude, place.longitude, place.timeZone])
  const clipId = useId()
  const focused = paths?.find((p) => p.key === focus)
  const up = sky.bodies.filter((b) => b.alt >= 0)
  const labels = useMemo(
    () =>
      placeLabels([
        ...sky.bodies
          .filter((b) => b.alt >= 0)
          .sort((a, b) => a.mag - b.mag)
          .map((b) => {
            const [x, y] = project(b.az, b.alt)
            return { key: b.key, text: t(b.name), x, y, r: bodyRadius(b), kind: 'body' as const }
          }),
        ...sky.stars
          .filter((st) => st.name)
          .map((st) => {
            const [x, y] = project(st.az, st.alt)
            return { key: `hip${st.hip}`, text: t(st.name!), x, y, r: starRadius(st.mag), kind: 'star' as const }
          }),
      ]),
    // t is new each render but changes only with the language
    [sky, language],
  )

  const lightNote = sky.light === 'day' ? t('太阳在地平线上，白天肉眼看不到星星，图中淡淡示意它们的位置。') : sky.light === 'twilight' ? t('晨昏蒙影中，只有最亮的星和行星可见。') : ''
  return (
    <section className="card" id="sky-now">
      <div className="fortunes-head sky-head">
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
          <input
            type="time"
            aria-label={t('时间')}
            value={wall.time}
            onChange={(e) => e.target.value && setPicked({ ...wall, time: e.target.value })}
          />
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
      <p className="muted row-note">
        {t('{place}上空 · 当地时间 {date} {time}', { place: t(place.name), date: wall.date, time: wall.time })}
        {picked ? '' : t('（随时间更新）')}
        {' · '}
        {t('上为北、左为东，如仰望天空。这是天体在天上的实际位置，与星盘里以黄道十二宫计的星座不同。')}
      </p>

      <div className="sky-layout">
        <svg className={`sky-map sky-${sky.light}`} viewBox="0 0 400 400" role="img" aria-label={t('此刻天空星图')}>
          <circle className="sky-disc" cx={C} cy={C} r={R} />
          {[30, 60].map((alt) => (
            <circle key={alt} className="sky-grid" cx={C} cy={C} r={(R * (90 - alt)) / 90} />
          ))}
          <line className="sky-grid" x1={C} y1={C - R} x2={C} y2={C + R} />
          <line className="sky-grid" x1={C - R} y1={C} x2={C + R} y2={C} />
          {(
            [
              ['北', 'N', 0],
              ['东', 'E', 90],
              ['南', 'S', 180],
              ['西', 'W', 270],
            ] as const
          ).map(([label, labelEn, az]) => {
            const [x, y] = project(az, -9)
            return (
              <text key={label} className="sky-compass" x={x} y={y} textAnchor="middle" dominantBaseline="central">
                {en ? labelEn : label}
              </text>
            )
          })}

          <g className="sky-stars">
            {sky.stars.map((s) => (
              <Star key={s.hip} star={s} name={s.name && t(s.name)} azimuth={azimuth} />
            ))}
          </g>
          {paths && (
            <>
              <defs>
                <clipPath id={clipId}>
                  <circle cx={C} cy={C} r={R} />
                </clipPath>
              </defs>
              <g className={`sky-paths${focus ? ' has-focus' : ''}`} clipPath={`url(#${clipId})`} aria-hidden="true">
                {paths.map((p) => (
                  <g key={p.key} className={`sky-path${focus === p.key ? ' on' : ''}`} style={{ color: BODY_COLOUR[p.key] }}>
                    <path className="past" d={p.past} />
                    <path className="future" d={p.future} />
                    {p.hours.map((h) => {
                      const [x, y] = project(h.az, h.alt)
                      return <circle key={h.hour} className="hour" cx={x} cy={y} r={1.6} />
                    })}
                  </g>
                ))}
              </g>
            </>
          )}
          <g className="sky-bodies">
            {up.map((b) => {
              const [x, y] = project(b.az, b.alt)
              return (
                <g key={b.key} className={`sky-body sky-${b.key}`} {...focusProps(b.key)}>
                  <title>{t('{name} · {direction} · 高 {altitude}°', { name: t(b.name), direction: azimuth(b.az), altitude: b.alt.toFixed(1) })}</title>
                  <circle cx={x} cy={y} r={bodyRadius(b)} fill={BODY_COLOUR[b.key]} opacity={b.key === 'moon' ? 0.4 + 0.6 * b.lit : 1} />
                </g>
              )
            })}
          </g>
          {focused && (
            <g className="sky-hour-labels" aria-hidden="true">
              {focused.hours.map((h) => {
                const [x, y] = project(h.az, h.alt)
                return (
                  <text key={h.hour} x={x + 4} y={y - 4}>
                    {t('{h}时', { h: h.hour })}
                  </text>
                )
              })}
            </g>
          )}
          <g className="sky-labels" aria-hidden="true">
            {labels.map((l) => (
              <text
                key={l.key}
                className={l.kind === 'body' ? 'sky-body-name' : 'sky-star-name'}
                x={l.x}
                y={l.y}
                textAnchor={l.anchor}
                dominantBaseline="central"
              >
                {l.text}
              </text>
            ))}
          </g>
        </svg>

        <div className="sky-side">
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
                <tr key={b.key} className={[b.alt < 0 && 'below', focus === b.key && 'on'].filter(Boolean).join(' ') || undefined} {...focusProps(b.key)}>
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
            {lightNote && <>{lightNote}</>}
            {lightNote && en && ' '}
            {t('地平线上有 {n} 颗 5 等以内的亮星，星点大小示亮度、颜色示温度。星表来自 d3-celestial（XHIP 依巴谷星表）。', { n: sky.stars.length })}
            {paths && en && ' '}
            {paths && t('彩色弧线是日月和肉眼可见的行星前后 12 小时在天上走过的路径：虚线已走过，实线将要走，圆点是整点；悬停天体或表格里的一行可看各整点。')}
          </p>
        </div>
      </div>
    </section>
  )
}

function Star({ star: s, name, azimuth }: { star: SkyStar; name?: string; azimuth: (az: number) => string }) {
  const t = useT()
  const [x, y] = project(s.az, s.alt)
  return (
    <circle cx={x} cy={y} r={starRadius(s.mag)} fill={starColour(s.bv)}>
      {name && <title>{t('{name} · {direction} · 高 {altitude}°', { name, direction: azimuth(s.az), altitude: s.alt.toFixed(1) })}</title>}
    </circle>
  )
}
