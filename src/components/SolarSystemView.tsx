import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SIGN_ELEMENT, SIGN_GLYPHS, SIGNS } from '../lib/astrology'
import { enDate } from '../lib/calendar'
import { zodiacStars } from '../lib/eclipticStars'
import { PLANETS, lightTime, orbits, planetsAt, seenTrail, type PlanetKey, type PlanetPosition } from '../lib/solarSystem'
import { usePick } from './usePick'
import { useSettings, useT } from '../settingsContext'
import { DateParts } from './BirthForm'
import { TitleMark } from './Logo'
import { BODY_COLOUR } from './SkyView'

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
  // 浮现: the orbits draw themselves round the Sun and the planets come out on them, on opening the
  // page and on changing the map's range; only backwards-filled, so nothing is left in effect after
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
  }, [scale])

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
          <svg
            ref={orreryRef}
            className={`orrery${focus ? ' has-focus' : ''}`}
            viewBox="-18 -18 436 436"
            role="img"
            aria-label={t('太阳系行星位置')}
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
              {PLANETS.map((p) => (
                <radialGradient key={p.key} id={`orrery-glow-${p.key}`}>
                  <stop offset="0" stopColor={BODY_COLOUR[p.key]} stopOpacity="0.45" />
                  <stop offset="1" stopColor={BODY_COLOUR[p.key]} stopOpacity="0" />
                </radialGradient>
              ))}
            </defs>
            <rect className="orrery-bg" x="-18" y="-18" width="436" height="436" rx="18" />
            {/* The zodiac: where each planet stands among the stars, seen from Earth, is marked on it */}
            <g className="orrery-zodiac">
              {SIGNS.map((name, i) => {
                const [gx, gy] = polar(i * 30 + 15, R_ZMID)
                const seen = focused && Math.floor(focused.geo / 30) === i
                return (
                  <g key={name} className={`orrery-sign ${SIGN_ELEMENT[i]}${seen ? ' on' : ''}`}>
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
                pathLength={1}
              />
            ))}
            <circle cx={C} cy={C} r={scale === 'inner' ? 44 : 30} fill="url(#orrery-sun-glow)" />
            <circle className="orrery-sun" cx={C} cy={C} r={scale === 'inner' ? 9 : 6} fill="url(#orrery-sun-core)" />
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
            {shown.map((p) => {
              const [x, y] = xy(p.x, p.y)
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

        <div className="sky-side">
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
