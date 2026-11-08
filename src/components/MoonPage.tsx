import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { SolarDay } from 'tyme4ts'
import { enDate } from '../lib/calendar'
import { mansionOf } from '../lib/mansions'
import { heightsAround, lunarEclipseAt, lunation, moonTimes, moonView, nextApsis, phaseAt, wallOf, type EclipseKind, type QuarterName } from '../lib/moonView'
import { formatAzimuth, moonPhaseName } from '../lib/sky'
import { loadSkyPlace, saveSkyPlace, type StarPlace } from '../lib/starPrefs'
import { toUtc } from '../lib/timeZone'
import { useSettings, useT, useTerm } from '../settingsContext'
import { DateParts } from './BirthForm'
import { TitleMark } from './Logo'
import { MoonGlyph } from './MoonGlyph'
import { PlacePicker } from './PlacePicker'
import { Immersive, useNarrow, WhenButton } from './Immersive'
import { fovFor, MOON_FOV_MAX, moonFovMin, MoonSky } from './MoonSky'

const DAY = 86_400_000
/** 月相海报, loaded only when asked for */
const MoonPoster = lazy(() => import('./MoonPoster'))
const HOUR = 3_600_000
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 观月: the Moon from a place, at a moment. Drawn large as it is seen there (MoonGlobe), with its
 * phase, age and 农历 day, where it is, when it rises, culminates and sets, how far it is and how it
 * is turned (its libration); under it, its height and the Sun's through the day, which the time is
 * dragged along, and the month of phases from one 朔 to the next. The place is the 天象 page's.
 */
export function MoonPage({
  fallbackPlace,
  day,
  birthPlace,
}: {
  fallbackPlace: StarPlace
  /** Opened from a day's Moon (日历): that day, in the evening (or now, for today); or an instant (a lunar eclipse) */
  day?: { year: number; month: number; day: number } | number | null
  /** Opened from a chart's 生辰月相海报: the birthplace to look from, for this visit */
  birthPlace?: StarPlace | null
}) {
  const t = useT()
  const term = useTerm()
  const { language } = useSettings()
  const en = language === 'en'
  // A birthplace is looked from only for this visit: the place kept for 观月 and 天象 stays as it is
  const [place, setPlaceState] = useState<StarPlace>(() => birthPlace ?? loadSkyPlace(fallbackPlace))
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
  const opensOnDay = () => {
    if (!day) return false
    if (typeof day === 'number') return true
    const today = wallOf(new Date(), place.timeZone)
    return !(today.year === day.year && today.month === day.month && today.day === day.day)
  }
  const [time, setTime] = useState(() =>
    typeof day === 'number' ? Math.round(day / 60_000) * 60_000 : opensOnDay() ? toUtc({ ...day!, hour: 21, minute: 0 }, place.timeZone).date.getTime() : Date.now(),
  )
  const [live, setLive] = useState(() => !opensOnDay())
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
  const heightsAt = useMemo(() => heightsAround(utc, latitude, longitude, timeZone), [noonKey, latitude, longitude, timeZone])
  const apsis = useMemo(() => nextApsis(utc), [dayKey])
  // The lunar eclipse now, or the next one (found again each hour)
  const hourKey = Math.floor(time / HOUR)
  const eclipse = useMemo(() => lunarEclipseAt(new Date(hourKey * HOUR)), [hourKey])
  const eclipseName: Record<EclipseKind, string> = { penumbral: t('半影月食'), partial: t('月偏食'), total: t('月全食') }
  const inShadow = (span: [Date, Date] | null) => !!span && time >= span[0].getTime() && time <= span[1].getTime()
  const eclipseNow = inShadow(eclipse.eclipse.penumbral)
    ? inShadow(eclipse.eclipse.total)
      ? t('全食中')
      : inShadow(eclipse.eclipse.partial)
        ? t('偏食中')
        : t('在半影中')
    : null
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

  // The Moon over the whole screen (MoonSky), zoomed from the eye's view to a telescope's; at first
  // it fills about two thirds of the screen's shorter side
  const narrow = useNarrow()
  const [fov, setFov] = useState<number | null>(null)
  const fovMin = moonFovMin(moon.diameter)
  const shownFov = fov ?? fovFor(moon.diameter, narrow ? 0.72 : 0.62)
  const zoomBy = (k: number) => setFov(Math.max(fovMin, Math.min(MOON_FOV_MAX, shownFov * k)))
  const [features, setFeatures] = useState(true)
  const [poster, setPoster] = useState(false)
  const phaseName = t(moonPhaseName(moon.phase))
  const lunar = lunarText(wall.year, wall.month, wall.day)
  const where = `${formatAzimuth(moon.az, language)} · ${up ? t('高 {altitude}°', { altitude: moon.alt.toFixed(1) }) : t('地平线下')}`
  const step = (ms: number) => pick(time + ms)

  // One line: the moment (its pickers under it), 现在, and an hour back or on
  const toolbar = (
    <div className="imm-glass imm-bar moon-bar">
      <h3 className="section-title">
        <TitleMark />
        {t('观月')}
      </h3>
      <WhenButton label={`${t('{m}月{d}日', { m: wall.month, d: wall.day })} ${pad(wall.hour)}:${pad(wall.minute)}`}>
        <DateParts label={t('日期')} value={wall} onChange={(d) => pick(atWall({ ...wall, ...d }))} />
        <input
          type="time"
          aria-label={t('时间')}
          value={`${pad(wall.hour)}:${pad(wall.minute)}`}
          onChange={(e) => {
            const [hour, minute] = e.target.value.split(':').map(Number)
            if (!Number.isNaN(hour)) pick(atWall({ ...wall, hour, minute }))
          }}
        />
        <span className="imm-steps">
          <button type="button" className="ghost" onClick={() => step(-DAY)}>
            {t('前一天')}
          </button>
          <button type="button" className="ghost" onClick={() => step(DAY)}>
            {t('后一天')}
          </button>
        </span>
      </WhenButton>
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
      <span className="imm-steps">
        <button type="button" className="ghost" onClick={() => step(-HOUR)} aria-label={t('前一小时')} title={t('前一小时')}>
          ◀
        </button>
        <button type="button" className="ghost" onClick={() => step(HOUR)} aria-label={t('后一小时')} title={t('后一小时')}>
          ▶
        </button>
      </span>
    </div>
  )

  const overlay = (
    <>
      <div className="moon-title">
        <div className="moon-name">
          <strong>{phaseName}</strong>
          <span>{lunar}</span>
        </div>
        <div className="moon-title-sub">
          {t('月龄 {n} 天', { n: age.toFixed(1) })} · {t('照亮 {pct}%', { pct: Math.round(moon.lit * 100) })}
          {eclipseNow && ` · ${eclipseName[eclipse.eclipse.kind]} · ${eclipseNow}`}
          {!up && ` · ${t('此刻月亮在地平线下')}`}
        </div>
      </div>
      <div className="imm-zoom" role="group" aria-label={t('缩放')}>
        <button type="button" onClick={() => zoomBy(1 / 1.6)} disabled={shownFov <= fovMin * 1.001} aria-label={t('放大')} title={t('放大')}>
          +
        </button>
        <button type="button" onClick={() => zoomBy(1.6)} disabled={shownFov >= MOON_FOV_MAX * 0.999} aria-label={t('缩小')} title={t('缩小')}>
          −
        </button>
        <button type="button" onClick={() => setFov(null)} disabled={fov === null} aria-label={t('复原')} title={t('复原')}>
          ⟲
        </button>
      </div>
      <p className="imm-hint">{t('左右拖动改变时间 · 滚轮或双指缩放')}</p>
    </>
  )

  const days = (
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
  )
  const heights = <MoonHeights heights={heightsAt} time={time} onPick={pick} clock={clock} compact={narrow ? 'small' : 'wide'} />

  const panel = (
    <>
      <div className="moon-facts">
        <dl className="sky-facts">
          <dt>{t('月龄')}</dt>
          <dd>{t('{n} 天', { n: age.toFixed(1) })}</dd>
          <dt>{t('照亮')}</dt>
          <dd>{Math.round(moon.lit * 100)}%</dd>
          <dt>{t('方位')}</dt>
          <dd>{where}</dd>
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
          <dt>{t('月食')}</dt>
          <dd className="moon-eclipse">
            {eclipseNow ? (
              <>
                {eclipseName[eclipse.eclipse.kind]} · {eclipseNow}
              </>
            ) : (
              <>
                {t('下次：{date} {kind}', { date: dateText(eclipse.eclipse.peak), kind: eclipseName[eclipse.eclipse.kind] })}
              </>
            )}
            <span className="muted">
              {t('食甚 {time}', { time: `${dateText(eclipse.eclipse.peak)} ${clock(eclipse.eclipse.peak)}` })}
              {eclipse.eclipse.partial && ` · ${t('初亏 {a} · 复圆 {b}', { a: clock(eclipse.eclipse.partial[0]), b: clock(eclipse.eclipse.partial[1]) })}`}
              {eclipse.eclipse.total && ` · ${t('食既 {a} · 生光 {b}', { a: clock(eclipse.eclipse.total[0]), b: clock(eclipse.eclipse.total[1]) })}`}
            </span>
            {Math.abs(eclipse.eclipse.peak.getTime() - time) > 60_000 && (
              <button type="button" className="ghost view-more" onClick={() => pick(Math.round(eclipse.eclipse.peak.getTime() / 60_000) * 60_000)}>
                {t('看食甚 →')}
              </button>
            )}
          </dd>
          <dt>{t('宿')}</dt>
          <dd>{t('月离{mansion}', { mansion: term(mansionOf(moon.ra).mansion.name) })}</dd>
        </dl>
      </div>
      <div className="moon-place">
        <PlacePicker label={t('观测地')} place={place} onChange={setPlace} />
        <button type="button" className="ghost" onClick={locate} disabled={locating === 'busy'}>
          {locating === 'busy' ? t('定位中…') : t('📍 用我的位置')}
        </button>
        {locating === 'failed' && <small className="muted">{t('无法取得位置（可能未授权），请从列表中选择城市。')}</small>}
      </div>
      <div className="moon-month">
        <h4 className="moon-month-title">{t('本月月相')}</h4>
        <ol className="moon-quarters">
          {month.quarters.map((q) => (
            <li key={q.time.getTime()}>
              <b>{quarterName[q.name]}</b> {dateText(q.time)} {clock(q.time)}
            </li>
          ))}
        </ol>
        {narrow && days}
      </div>
      <button type="button" className="ghost moon-poster-button" data-sound="gong" onClick={() => setPoster(true)}>
        {t('生成月相海报')}
      </button>
      {poster && (
        <Suspense fallback={null}>
          <MoonPoster
            moon={moon}
            date={en ? dateText(utc) : `${wall.year}年${wall.month}月${wall.day}日`}
            time={`${pad(wall.hour)}:${pad(wall.minute)}`}
            phase={`${phaseName} · ${lunar} · ${t('照亮 {pct}%', { pct: Math.round(moon.lit * 100) })}`}
            place={t(place.name)}
            defaultTitle={birthPlace ? t('生辰月相') : undefined}
            onClose={() => setPoster(false)}
          />
        </Suspense>
      )}
      <div className="sky-switches">
        <button type="button" role="switch" aria-checked={features} className={`sky-switch${features ? ' on' : ''}`} onClick={() => setFeatures((f) => !f)}>
          {t('月海与环形山的名字')}
          <span className="sky-switch-track" aria-hidden="true" />
        </button>
      </div>
      <p className="muted row-note">
        {t('月亮按你在此地所见画出：天顶在上，亮面朝向太阳，并随天平动微微转动。')}{' '}
        {t('月面图像：NASA 科学可视化工作室（CGI Moon Kit，LRO 数据）。')}
      </p>
    </>
  )

  return (
    <Immersive
      name="moon-page"
      backdrop={(frame) => (
        <MoonSky
          utc={utc}
          latitude={latitude}
          longitude={longitude}
          moon={moon}
          // On a phone the title lies under the Moon: it is centred in the room above it
          frame={narrow ? { ...frame, height: Math.max(120, frame.height - 96) } : frame}
          fov={shownFov}
          onFov={setFov}
          onScrub={step}
          features={features}
          en={en}
          name={(zh) => t(zh)}
          globeLabel={t('{phase}，照亮 {n}%', { phase: phaseName, n: Math.round(moon.lit * 100) })}
        />
      )}
      toolbar={toolbar}
      overlay={overlay}
      panelTitle={t('此刻的月亮')}
      panel={panel}
      summary={`${phaseName} · ${lunar} · ${t('照亮 {pct}%', { pct: Math.round(moon.lit * 100) })} · ${where}`}
      bottom={
        narrow ? (
          heights
        ) : (
          <div className="imm-glass moon-strip">
            {days}
            {heights}
          </div>
        )
      }
    />
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
 * shaded, the horizon, the Moon's path above it. Drag along it to move the time within that day, or
 * use the arrow keys, which go on into the days either side.
 */
function MoonHeights({
  heights,
  time,
  onPick,
  clock,
  compact,
}: {
  heights: ReturnType<typeof heightsAround>
  time: number
  onPick: (ms: number) => void
  clock: (d: Date) => string
  /** A strip along the bottom of the screen (wide), or under the phone's sheet (small) */
  compact?: 'wide' | 'small'
}) {
  const t = useT()
  const [W, H, X0, X1, TOP, BOTTOM] =
    compact === 'wide' ? [1000, 86, 26, 992, 4, 68] : compact === 'small' ? [360, 70, 22, 356, 4, 54] : [720, 168, 30, 712, 12, 146]
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
  // A drag stays within the day shown, up to a minute before the next noon: at the noon itself the
  // chart would move on to the next day under a pointer still at its edge, and on, a day a step
  const at = (clientX: number) => {
    const r = svgRef.current!.getBoundingClientRect()
    const x = ((clientX - r.left) / r.width) * W
    const ms = Math.round((start + ((Math.max(X0, Math.min(X1, x)) - X0) / (X1 - X0)) * span) / 60_000) * 60_000
    onPick(Math.min(ms, start + span - 60_000))
  }
  return (
    <div className={`moon-heights${compact ? ` ${compact}` : ''}`}>
      {!compact && (
        <h4 className="moon-month-title">
          {t('月亮的高度')}
          <small className="muted"> · {t('拖动或用方向键改变时间')}</small>
        </h4>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        tabIndex={0}
        role="slider"
        aria-label={compact ? t('月亮的高度 · 拖动或用方向键改变时间') : t('时间')}
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
        {(compact ? [45] : [30, 60]).map((a) => (
          <g key={a}>
            <line className="mh-grid" x1={X0} x2={X1} y1={yOf(a)} y2={yOf(a)} />
            <text className="mh-label" x={X0 - 4} y={yOf(a) + 3} textAnchor="end">
              {a}°
            </text>
          </g>
        ))}
        <path className="mh-moon" d={path} />
        {s
          .filter((p) => clock(p.time).endsWith(':00') && Number(clock(p.time).slice(0, 2)) % (compact === 'small' ? 6 : 3) === 0)
          .map((p) => (
            <text key={p.time.getTime()} className="mh-label" x={xOf(p.time.getTime())} y={H - 6} textAnchor="middle">
              {clock(p.time)}
            </text>
          ))}
        <line className="mh-now" x1={xOf(time)} x2={xOf(time)} y1={TOP} y2={BOTTOM} />
        <circle className="mh-dot" cx={xOf(time)} cy={yOf(nowAlt)} r={compact ? 4 : 5} />
      </svg>
    </div>
  )
}
