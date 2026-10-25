import { useEffect, useMemo, useRef, useState } from 'react'
import { enDate } from '../lib/calendar'
import { PLANETS, lightTime, orbits, planetsAt, type PlanetKey, type PlanetPosition } from '../lib/solarSystem'
import { useSettings, useT } from '../settingsContext'
import { DateParts } from './BirthForm'
import { TitleMark } from './Logo'
import { BODY_COLOUR } from './SkyView'

const C = 200
const R = 180
const DAY = 86400000

type Scale = 'inner' | 'all'
/** inner: true distances out to Mars; all: square-root distances out to Pluto, so the inner planets still show */
const SCALE: Record<Scale, { max: number; r: (au: number) => number }> = {
  inner: { max: 1.75, r: (au) => (R * au) / 1.75 },
  all: { max: 50, r: (au) => R * Math.sqrt(au / 50) },
}
const INNER: PlanetKey[] = ['mercury', 'venus', 'earth', 'mars']

/** Days of simulated time per second of playback */
const SPEEDS = [1, 7, 30, 365]

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 太阳系: the planets on their orbits, seen from above the ecliptic (north up
 * out of the page, so they all go round counter-clockwise), at now or at a
 * picked date, with playback to watch them move.
 */
export function SolarSystemView() {
  const t = useT()
  const { language } = useSettings()
  const en = language === 'en'
  const scaleLabel: Record<Scale, string> = { inner: t('内太阳系'), all: t('全太阳系') }
  const speedLabel: Record<number, string> = { 1: t('1 天/秒'), 7: t('1 周/秒'), 30: t('1 月/秒'), 365: t('1 年/秒') }
  const [time, setTime] = useState(() => Date.now())
  const [live, setLive] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(7)
  const [scale, setScale] = useState<Scale>('inner')
  const [focus, setFocus] = useState<PlanetKey | null>(null)

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

  const planets = useMemo(() => planetsAt(new Date(time)), [time])
  // Orbits barely change over a lifetime: one set, sampled once.
  const paths = useMemo(() => orbits(new Date()), [])
  const s = SCALE[scale]
  const xy = (x: number, y: number): [number, number] => {
    const d = Math.hypot(x, y)
    const k = d ? s.r(d) / d : 0
    return [C + x * k, C - y * k]
  }
  // The orbits' outlines only change with the scale, not with the date (which playback moves every frame)
  const orbitPoints = useMemo(
    () => Object.fromEntries(Object.entries(paths).map(([key, pts]) => [key, pts.map(([x, y]) => xy(x, y).join(',')).join(' ')])),
    // xy follows the scale
    [paths, scale],
  )
  /** Where an off-map planet's direction meets the rim */
  const rim = (p: PlanetPosition): [number, number] => {
    const a = Math.atan2(p.y, p.x)
    return [C + (R + 8) * Math.cos(a), C - (R + 8) * Math.sin(a)]
  }
  const shown = planets.filter((p) => scale === 'all' || INNER.includes(p.key))
  const beyond = planets.filter((p) => scale === 'inner' && !INNER.includes(p.key))
  const earth = planets.find((p) => p.key === 'earth')!
  const date = new Date(time)
  const ymd = { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
  const hover = (key: PlanetKey) => ({
    tabIndex: 0,
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === 'mouse' && setFocus(key),
    onPointerLeave: (e: React.PointerEvent) => e.pointerType === 'mouse' && setFocus(null),
    onFocus: () => setFocus(key),
    onBlur: () => setFocus(null),
  })
  const focused = planets.find((p) => p.key === focus)

  return (
    <section className="card" id="sky-solar">
      <div className="fortunes-head sky-head">
        <h3 className="section-title">
          <TitleMark />
          {t('太阳系')}
        </h3>
        <div className="overlay-bar sky-controls">
          <DateParts
            label={t('日期')}
            value={ymd}
            onChange={(d) => {
              const keep = new Date(time)
              setLive(false)
              setTime(new Date(d.year, d.month - 1, d.day, keep.getHours(), keep.getMinutes()).getTime())
            }}
          />
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
          <button
            type="button"
            className={`ghost toggle${playing ? ' on' : ''}`}
            aria-pressed={playing}
            onClick={() => {
              setLive(false)
              setPlaying((p) => !p)
            }}
          >
            {playing ? t('❚❚ 暂停') : t('▶ 播放')}
          </button>
          <select aria-label={t('播放速度')} value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((days) => (
              <option key={days} value={days}>
                {speedLabel[days]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="muted row-note">
        {en
          ? enDate(ymd.year, ymd.month, ymd.day, { day: 'numeric', month: 'short', year: 'numeric' })
          : `${ymd.year}年${ymd.month}月${ymd.day}日`}{' '}
        {pad(date.getHours())}:{pad(date.getMinutes())}
        {live && !playing ? t('（随时间更新）') : ''}
        {' · '}
        {t('从黄道北极俯视，行星都沿逆时针方向公转；右方是春分点方向（黄经 0°）。')}
        {en && ' '}
        {scale === 'inner' ? t('距离按真实比例。') : t('为了让内行星也看得见，距离按平方根压缩。')}
      </p>

      <div className="sky-layout">
        <div>
          <div className="seg small orrery-scale" role="group" aria-label={t('范围')}>
            {(Object.keys(SCALE) as Scale[]).map((k) => (
              <button key={k} className={scale === k ? 'on' : undefined} onClick={() => setScale(k)}>
                {scaleLabel[k]}
              </button>
            ))}
          </div>
          <svg className={`orrery${focus ? ' has-focus' : ''}`} viewBox="0 0 400 400" role="img" aria-label={t('太阳系行星位置')}>
            <rect className="orrery-bg" x="0" y="0" width="400" height="400" rx="16" />
            {scale === 'inner' &&
              [0.5, 1, 1.5].map((au) => (
                <g key={au}>
                  <circle className="orrery-grid" cx={C} cy={C} r={s.r(au)} />
                  <text className="orrery-au" x={C + 3} y={C - s.r(au) - 3}>
                    {au} AU
                  </text>
                </g>
              ))}
            {scale === 'all' &&
              [1, 5, 10, 20, 30, 40].map((au) => (
                <g key={au}>
                  <circle className="orrery-grid" cx={C} cy={C} r={s.r(au)} />
                  {au >= 5 && (
                    <text className="orrery-au" x={C + 3} y={C - s.r(au) - 3}>
                      {au} AU
                    </text>
                  )}
                </g>
              ))}
            <text className="orrery-equinox" x={394} y={C + 14} textAnchor="end">
              {t('♈︎ 春分点 →')}
            </text>
            {PLANETS.filter((p) => scale === 'all' || INNER.includes(p.key)).map((p) => (
              <polygon
                key={p.key}
                className={`orrery-orbit${focus === p.key ? ' on' : ''}`}
                points={orbitPoints[p.key]}
                stroke={BODY_COLOUR[p.key]}
              />
            ))}
            <circle className="orrery-sun" cx={C} cy={C} r={scale === 'inner' ? 9 : 6} />
            {/* Earth's line of sight to the hovered planet (to its rim mark when off the map) */}
            {focused && focused.key !== 'earth' && (
              <line
                className="orrery-sight"
                x1={xy(earth.x, earth.y)[0]}
                y1={xy(earth.x, earth.y)[1]}
                x2={shown.includes(focused) ? xy(focused.x, focused.y)[0] : rim(focused)[0]}
                y2={shown.includes(focused) ? xy(focused.x, focused.y)[1] : rim(focused)[1]}
              />
            )}
            {shown.map((p) => {
              const [x, y] = xy(p.x, p.y)
              return (
                <g key={p.key} className={`orrery-planet pl-${p.key}${focus === p.key ? ' on' : ''}`} {...hover(p.key)}>
                  <title>
                    {t('{name} · 距太阳 {sun} AU', { name: t(p.name), sun: p.sun.toFixed(2) })}
                    {p.key !== 'earth' && ` · ${t('距地球 {earth} AU', { earth: p.earth.toFixed(2) })}`}
                  </title>
                  <circle cx={x} cy={y} r={11} className="orrery-hit" />
                  <circle cx={x} cy={y} r={p.key === 'jupiter' || p.key === 'saturn' ? 5.5 : 4.2} fill={BODY_COLOUR[p.key]} />
                  {p.key === 'saturn' && <ellipse cx={x} cy={y} rx={9} ry={3} className="orrery-ring" />}
                  {/* On the whole-system map the inner planets crowd the Sun: only Earth keeps its name. */}
                  {(scale === 'inner' || !INNER.includes(p.key) || p.key === 'earth') && (
                    <text x={x} y={y - 9} textAnchor="middle" className="orrery-name">
                      {t(p.name)}
                    </text>
                  )}
                </g>
              )
            })}
            {/* The outer planets, off the inner map: a mark on the rim in their direction */}
            {beyond.map((p) => {
              const [x, y] = rim(p)
              return (
                <g key={p.key} className={`orrery-beyond${focus === p.key ? ' on' : ''}`} {...hover(p.key)}>
                  <title>
                    {t('{name}在这个方向，距太阳 {sun} AU', { name: t(p.name), sun: p.sun.toFixed(1) })}
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

        <div className="sky-side">
          <table className="star-table sky-table orrery-table">
            <thead>
              <tr>
                <th>{t('行星')}</th>
                <th>{t('距太阳')}</th>
                <th>{t('距地球')}</th>
                <th>{t('光行时')}</th>
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
        </div>
      </div>
    </section>
  )
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
      <td>{p.key === 'earth' ? '—' : lightTime(p.earth, language)}</td>
      <td className={p.retrograde ? 'retro' : undefined}>{p.key === 'earth' ? '—' : p.retrograde ? t('逆行') : t('顺行')}</td>
    </tr>
  )
}
