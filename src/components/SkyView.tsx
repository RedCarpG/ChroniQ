import { useEffect, useMemo, useState } from 'react'
import { toUtc, type StarPlace } from '../lib/astrology'
import { formatAzimuth, skyAt, type SkyBody, type SkyStar } from '../lib/sky'
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

const BODY_COLOUR: Record<string, string> = {
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
    const w = [...p.text].length * size
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

const LIGHT_NOTE = {
  day: '太阳在地平线上，白天肉眼看不到星星，图中淡淡示意它们的位置。',
  twilight: '晨昏蒙影中，只有最亮的星和行星可见。',
  night: '',
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
 * 此刻天空: the real sky above the 星盘's place — the Sun, Moon, planets and
 * stars to magnitude 5 that are above the horizon. It follows the present
 * moment until a date or time is picked (read in the place's time zone).
 */
export function SkyView({ place }: { place: StarPlace }) {
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
  const up = sky.bodies.filter((b) => b.alt >= 0)
  const labels = useMemo(
    () =>
      placeLabels([
        ...sky.bodies
          .filter((b) => b.alt >= 0)
          .sort((a, b) => a.mag - b.mag)
          .map((b) => {
            const [x, y] = project(b.az, b.alt)
            return { key: b.key, text: b.name, x, y, r: bodyRadius(b), kind: 'body' as const }
          }),
        ...sky.stars
          .filter((st) => st.name)
          .map((st) => {
            const [x, y] = project(st.az, st.alt)
            return { key: `hip${st.hip}`, text: st.name!, x, y, r: starRadius(st.mag), kind: 'star' as const }
          }),
      ]),
    [sky],
  )

  return (
    <section className="card" id="star-sky">
      <div className="fortunes-head sky-head">
        <h3 className="section-title">
          <TitleMark />
          此刻天空
        </h3>
        <div className="overlay-bar sky-controls">
          <input
            type="date"
            aria-label="日期"
            value={wall.date}
            min="1900-01-01"
            max="2100-12-31"
            onChange={(e) => e.target.value && setPicked({ ...wall, date: e.target.value })}
          />
          <input
            type="time"
            aria-label="时间"
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
            现在
          </button>
        </div>
      </div>
      <p className="muted row-note">
        {place.name}上空 · 当地时间 {wall.date} {wall.time}
        {picked ? '' : '（随时间更新）'} · 上为北、左为东，如仰望天空。这是天体在天上的实际位置，与上方以黄道十二宫计的星座不同。
      </p>

      <div className="sky-layout">
        <svg className={`sky-map sky-${sky.light}`} viewBox="0 0 400 400" role="img" aria-label="此刻天空星图">
          <circle className="sky-disc" cx={C} cy={C} r={R} />
          {[30, 60].map((alt) => (
            <circle key={alt} className="sky-grid" cx={C} cy={C} r={(R * (90 - alt)) / 90} />
          ))}
          <line className="sky-grid" x1={C} y1={C - R} x2={C} y2={C + R} />
          <line className="sky-grid" x1={C - R} y1={C} x2={C + R} y2={C} />
          {(
            [
              ['北', 0],
              ['东', 90],
              ['南', 180],
              ['西', 270],
            ] as const
          ).map(([label, az]) => {
            const [x, y] = project(az, -9)
            return (
              <text key={label} className="sky-compass" x={x} y={y} textAnchor="middle" dominantBaseline="central">
                {label}
              </text>
            )
          })}

          <g className="sky-stars">
            {sky.stars.map((s) => (
              <Star key={s.hip} star={s} />
            ))}
          </g>
          <g className="sky-bodies">
            {up.map((b) => {
              const [x, y] = project(b.az, b.alt)
              return (
                <g key={b.key} className={`sky-body sky-${b.key}`}>
                  <title>
                    {b.name} · {formatAzimuth(b.az)} · 高 {b.alt.toFixed(1)}°
                  </title>
                  <circle cx={x} cy={y} r={bodyRadius(b)} fill={BODY_COLOUR[b.key]} opacity={b.key === 'moon' ? 0.4 + 0.6 * b.lit : 1} />
                </g>
              )
            })}
          </g>
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
                <th>天体</th>
                <th>方位</th>
                <th>高度</th>
                <th>星等</th>
              </tr>
            </thead>
            <tbody>
              {sky.bodies.map((b) => (
                <tr key={b.key} className={b.alt < 0 ? 'below' : undefined}>
                  <td>
                    <span className="sky-dot" style={{ background: BODY_COLOUR[b.key] }} />
                    {b.name}
                  </td>
                  <td>{formatAzimuth(b.az)}</td>
                  <td>{b.alt < 0 ? '地平线下' : `${b.alt.toFixed(1)}°`}</td>
                  <td>{b.mag.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted row-note">
            {LIGHT_NOTE[sky.light] && <>{LIGHT_NOTE[sky.light]}</>}
            地平线上有 {sky.stars.length} 颗 5 等以内的亮星，星点大小示亮度、颜色示温度。星表来自 d3-celestial（XHIP 依巴谷星表）。
          </p>
        </div>
      </div>
    </section>
  )
}

function Star({ star: s }: { star: SkyStar }) {
  const [x, y] = project(s.az, s.alt)
  return (
    <circle cx={x} cy={y} r={starRadius(s.mag)} fill={starColour(s.bv)}>
      {s.name && (
        <title>
          {s.name} · {formatAzimuth(s.az)} · 高 {s.alt.toFixed(1)}°
        </title>
      )}
    </circle>
  )
}
