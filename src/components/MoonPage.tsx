import { useEffect, useMemo, useRef, useState } from 'react'
import { SolarDay } from 'tyme4ts'
import { enDate } from '../lib/calendar'
import { mansionOf } from '../lib/mansions'
import { heightsAround, lunation, moonTimes, moonView, nextApsis, phaseAt, wallOf, type QuarterName } from '../lib/moonView'
import { formatAzimuth, moonPhaseName } from '../lib/sky'
import { loadSkyPlace, saveSkyPlace, type StarPlace } from '../lib/starPrefs'
import { toUtc } from '../lib/timeZone'
import { useSettings, useT, useTerm } from '../settingsContext'
import { DateParts } from './BirthForm'
import { TitleMark } from './Logo'
import { MoonGlobe } from './MoonGlobe'
import { MoonGlyph } from './MoonGlyph'
import { PlacePicker } from './PlacePicker'

const DAY = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 观月: the Moon from a place, at a moment. Drawn large as it is seen there (MoonGlobe), with its
 * phase, age and 农历 day, where it is, when it rises, culminates and sets, how far it is and how it
 * is turned (its libration); under it, its height and the Sun's through the day, which the time is
 * dragged along, and the month of phases from one 朔 to the next. The place is the 天象 page's.
 */
export function MoonPage({ fallbackPlace }: { fallbackPlace: StarPlace }) {
  const t = useT()
  const term = useTerm()
  const { language } = useSettings()
  const en = language === 'en'
  const [place, setPlaceState] = useState<StarPlace>(() => loadSkyPlace(fallbackPlace))
  const setPlace = (next: StarPlace) => {
    setPlaceState(next)
    saveSkyPlace(next)
  }
  const [locating, setLocating] = useState<'idle' | 'busy' | 'failed'>('idle')
  const locate = () => {
    if (!navigator.geolocation) return setLocating('failed')
    setLocating('busy')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating('idle')
        setPlace({
          name: '我的位置',
          latitude: Math.round(coords.latitude * 100) / 100,
          longitude: Math.round(coords.longitude * 100) / 100,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      },
      () => setLocating('failed'),
      { maximumAge: 600_000, timeout: 15_000 },
    )
  }

  // The moment: now (kept up to the minute), or one chosen
  const [time, setTime] = useState(() => Date.now())
  const [live, setLive] = useState(true)
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setTime(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [live])
  const pick = (ms: number) => {
    setLive(false)
    setTime(ms)
  }
  const { latitude, longitude, timeZone } = place
  const utc = new Date(time)
  const wall = wallOf(utc, timeZone)
  const atWall = (w: { year: number; month: number; day: number; hour: number; minute: number }) => toUtc(w, timeZone).date.getTime()

  const moon = useMemo(() => moonView(new Date(time), latitude, longitude), [time, latitude, longitude])
  // The lunation, found again only once the moment leaves it
  const lunationRef = useRef<ReturnType<typeof lunation> | null>(null)
  if (!lunationRef.current || utc < lunationRef.current.start || utc >= lunationRef.current.end) lunationRef.current = lunation(utc)
  const month = lunationRef.current
  const dayKey = `${wall.year}-${wall.month}-${wall.day}`
  const times = useMemo(() => moonTimes(wall, latitude, longitude, timeZone), [dayKey, latitude, longitude, timeZone])
  const noonKey = `${dayKey} ${wall.hour < 12}`
  const heights = useMemo(() => heightsAround(utc, latitude, longitude, timeZone), [noonKey, latitude, longitude, timeZone])
  const apsis = useMemo(() => nextApsis(utc), [dayKey])
  const lunarText = (y: number, m: number, d: number) => {
    const lunar = SolarDay.fromYmd(y, m, d).getLunarDay()
    return term(`${lunar.getLunarMonth().getName()}${lunar.getName()}`)
  }

  /** A local date, short */
  const dateText = (d: Date) => {
    const w = wallOf(d, timeZone)
    return en ? enDate(w.year, w.month, w.day, { month: 'short', day: 'numeric' }) : `${w.month}月${w.day}日`
  }
  const clock = (d: Date) => {
    const w = wallOf(d, timeZone)
    return `${pad(w.hour)}:${pad(w.minute)}`
  }
  const age = (time - month.start.getTime()) / DAY
  const up = moon.alt > 0
  const quarterName: Record<QuarterName, string> = { 朔: t('朔'), 上弦: t('上弦'), 望: t('望'), 下弦: t('下弦') }

  return (
    <div className="moon-page">
      <section className="card">
        <div className="fortunes-head sky-head">
          <h3 className="section-title">
            <TitleMark />
            {t('观月')}
          </h3>
          <div className="overlay-bar sky-controls">
            <DateParts
              label={t('日期')}
              value={wall}
              onChange={(d) => pick(atWall({ ...wall, ...d }))}
            />
            <input
              type="time"
              aria-label={t('时间')}
              value={`${pad(wall.hour)}:${pad(wall.minute)}`}
              onChange={(e) => {
                const [hour, minute] = e.target.value.split(':').map(Number)
                if (!Number.isNaN(hour)) pick(atWall({ ...wall, hour, minute }))
              }}
            />
            <button
              type="button"
              className={`ghost toggle${live ? ' on' : ''}`}
              aria-pressed={live}
              onClick={() => {
                setLive(true)
                setTime(Date.now())
              }}
            >
              {t('现在')}
            </button>
          </div>
        </div>

        <div className="moon-layout">
          <div className={`moon-stage${up ? '' : ' down'}`} style={{ '--glow': (0.15 + 0.5 * moon.lit).toFixed(2) } as React.CSSProperties}>
            <MoonGlobe frame={moon.frame} lit={moon.lit} label={t('{phase}，照亮 {n}%', { phase: t(moonPhaseName(moon.phase)), n: Math.round(moon.lit * 100) })} />
            {!up && <span className="moon-down-note">{t('此刻月亮在地平线下')}</span>}
          </div>
          <div className="moon-facts">
            <div className="moon-name">
              <strong>{t(moonPhaseName(moon.phase))}</strong>
              <span>{lunarText(wall.year, wall.month, wall.day)}</span>
            </div>
            <dl className="sky-facts">
              <dt>{t('月龄')}</dt>
              <dd>{t('{n} 天', { n: age.toFixed(1) })}</dd>
              <dt>{t('照亮')}</dt>
              <dd>{Math.round(moon.lit * 100)}%</dd>
              <dt>{t('方位')}</dt>
              <dd>
                {formatAzimuth(moon.az, language)} · {up ? t('高 {altitude}°', { altitude: moon.alt.toFixed(1) }) : t('地平线下')}
              </dd>
              <dt>{t('月出')}</dt>
              <dd>{times.rise ? clock(times.rise) : '—'}</dd>
              <dt>{t('中天')}</dt>
              <dd>{times.transit ? clock(times.transit) : '—'}</dd>
              <dt>{t('月落')}</dt>
              <dd>{times.set ? clock(times.set) : '—'}</dd>
              <dt>{t('距离')}</dt>
              <dd>
                {t('约 {n} 万公里', { n: en ? Math.round(moon.distanceKm / 1000) * 1000 : (moon.distanceKm / 1e4).toFixed(1) })} ·{' '}
                {t('视直径 {d}′', { d: (moon.diameter * 60).toFixed(1) })}
              </dd>
              <dt>{apsis.kind === 'perigee' ? t('下次近地点') : t('下次远地点')}</dt>
              <dd>
                {dateText(apsis.time)} {clock(apsis.time)} · {t('约 {n} 万公里', { n: en ? Math.round(apsis.distanceKm / 1000) * 1000 : (apsis.distanceKm / 1e4).toFixed(1) })}
              </dd>
              <dt>
                <span className="tip-label" title={t('天平动让我们能多看到月面边缘的一点：经度为正时东缘（危海一侧）转过来，纬度为正时北缘转过来。')}>
                  {t('天平动')}
                </span>
              </dt>
              <dd>{t('经 {lon}° · 纬 {lat}°', { lon: signed(moon.libration.lon), lat: signed(moon.libration.lat) })}</dd>
              <dt>{t('宿')}</dt>
              <dd>{t('月离{mansion}', { mansion: term(mansionOf(moon.ra).mansion.name) })}</dd>
            </dl>
            <div className="moon-place">
              <PlacePicker label={t('观测地')} place={place} onChange={setPlace} />
              <button type="button" className="ghost" onClick={locate} disabled={locating === 'busy'}>
                {locating === 'busy' ? t('定位中…') : t('📍 用我的位置')}
              </button>
              {locating === 'failed' && <small className="muted">{t('无法取得位置（可能未授权），请从列表中选择城市。')}</small>}
            </div>
          </div>
        </div>

        <MoonHeights heights={heights} time={time} onPick={pick} clock={clock} />

        <div className="moon-month">
          <h4 className="moon-month-title">{t('本月月相')}</h4>
          <ol className="moon-quarters">
            {month.quarters.map((q) => (
              <li key={q.time.getTime()}>
                <b>{quarterName[q.name]}</b> {dateText(q.time)} {clock(q.time)}
              </li>
            ))}
          </ol>
          <div className="moon-days" role="group" aria-label={t('本月月相')}>
            {monthDays(month.start, month.end, timeZone).map((d) => {
              const on = d.year === wall.year && d.month === wall.month && d.day === wall.day
              const glyph = phaseAt(new Date(atWall({ ...d, hour: 21, minute: 0 })))
              return (
                <button
                  key={`${d.month}-${d.day}`}
                  type="button"
                  className={`moon-day${on ? ' on' : ''}`}
                  aria-pressed={on}
                  onClick={() => pick(atWall({ ...wall, ...d }))}
                >
                  <MoonGlyph moon={{ angle: glyph.angle, lit: glyph.lit, name: '' }} />
                  <span className="moon-day-lunar">{lunarText(d.year, d.month, d.day).slice(-2)}</span>
                  <small>
                    {d.month}/{d.day}
                  </small>
                </button>
              )
            })}
          </div>
        </div>

        <p className="muted row-note">
          {t('月亮按你在此地所见画出：天顶在上，亮面朝向太阳，并随天平动微微转动。')}{' '}
          {t('月面图像：NASA 科学可视化工作室（CGI Moon Kit，LRO 数据）。')}
        </p>
      </section>
    </div>
  )
}

const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}`

/** The local dates from one instant to another */
function monthDays(start: Date, end: Date, timeZone: string) {
  const out: { year: number; month: number; day: number }[] = []
  const first = wallOf(start, timeZone)
  const last = wallOf(end, timeZone)
  for (let d = SolarDay.fromYmd(first.year, first.month, first.day); ; d = d.next(1)) {
    out.push({ year: d.getYear(), month: d.getMonth(), day: d.getDay() })
    if (d.getYear() === last.year && d.getMonth() === last.month && d.getDay() === last.day) break
    if (out.length > 40) break
  }
  return out
}

/**
 * The Moon's height and the Sun's through the day around the moment (noon to noon): the night
 * shaded, the horizon, the Moon's path above it. Drag along it, or use the arrow keys, to move the
 * time.
 */
function MoonHeights({
  heights,
  time,
  onPick,
  clock,
}: {
  heights: ReturnType<typeof heightsAround>
  time: number
  onPick: (ms: number) => void
  clock: (d: Date) => string
}) {
  const t = useT()
  const [W, H, X0, X1, TOP, BOTTOM] = [720, 168, 30, 712, 12, 146]
  const start = heights.start.getTime()
  const span = heights.end.getTime() - start
  const xOf = (ms: number) => X0 + ((ms - start) / span) * (X1 - X0)
  const yOf = (alt: number) => BOTTOM - ((Math.max(-20, Math.min(90, alt)) + 20) / 110) * (BOTTOM - TOP)
  const s = heights.samples
  const path = s.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.time.getTime()).toFixed(1)} ${yOf(p.moon).toFixed(1)}`).join('')
  const sky = (sun: number) => (sun > 0 ? 'day' : sun > -18 ? 'twilight' : 'night')
  // The height now, between the samples either side
  const k = Math.max(0, Math.min(s.length - 2, Math.floor(((time - start) / span) * (s.length - 1))))
  const f = Math.max(0, Math.min(1, (time - s[k].time.getTime()) / (s[k + 1].time.getTime() - s[k].time.getTime())))
  const nowAlt = s[k].moon + (s[k + 1].moon - s[k].moon) * f
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const at = (clientX: number) => {
    const r = svgRef.current!.getBoundingClientRect()
    const x = ((clientX - r.left) / r.width) * W
    onPick(Math.round((start + ((Math.max(X0, Math.min(X1, x)) - X0) / (X1 - X0)) * span) / 60_000) * 60_000)
  }
  return (
    <div className="moon-heights">
      <h4 className="moon-month-title">
        {t('月亮的高度')}
        <small className="muted"> · {t('拖动或用方向键改变时间')}</small>
      </h4>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        tabIndex={0}
        role="slider"
        aria-label={t('时间')}
        aria-valuemin={start}
        aria-valuemax={start + span}
        aria-valuenow={time}
        aria-valuetext={clock(new Date(time))}
        onPointerDown={(e) => {
          dragging.current = true
          try {
            svgRef.current?.setPointerCapture(e.pointerId)
          } catch {
            // not a live pointer
          }
          at(e.clientX)
        }}
        onPointerMove={(e) => dragging.current && at(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={(e) => {
          const step = (e.shiftKey ? 60 : 15) * 60_000
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault()
            onPick(time + (e.key === 'ArrowRight' ? step : -step))
          }
        }}
      >
        {s.slice(0, -1).map((p, i) => (
          <rect
            key={i}
            className={`mh-${sky((p.sun + s[i + 1].sun) / 2)}`}
            x={xOf(p.time.getTime())}
            y={TOP}
            width={xOf(s[i + 1].time.getTime()) - xOf(p.time.getTime()) + 0.5}
            height={BOTTOM - TOP}
          />
        ))}
        <line className="mh-horizon" x1={X0} x2={X1} y1={yOf(0)} y2={yOf(0)} />
        {[30, 60].map((a) => (
          <g key={a}>
            <line className="mh-grid" x1={X0} x2={X1} y1={yOf(a)} y2={yOf(a)} />
            <text className="mh-label" x={X0 - 4} y={yOf(a) + 3} textAnchor="end">
              {a}°
            </text>
          </g>
        ))}
        <path className="mh-moon" d={path} />
        {s
          .filter((p) => clock(p.time).endsWith(':00') && Number(clock(p.time).slice(0, 2)) % 3 === 0)
          .map((p) => (
            <text key={p.time.getTime()} className="mh-label" x={xOf(p.time.getTime())} y={H - 6} textAnchor="middle">
              {clock(p.time)}
            </text>
          ))}
        <line className="mh-now" x1={xOf(time)} x2={xOf(time)} y1={TOP} y2={BOTTOM} />
        <circle className="mh-dot" cx={xOf(time)} cy={yOf(nowAlt)} r={5} />
      </svg>
    </div>
  )
}
