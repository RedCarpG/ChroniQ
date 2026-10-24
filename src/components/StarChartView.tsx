import { useMemo, useState } from 'react'
import { ASPECT_INFO, HOUSE_INFO, PLANET_INFO, SIGN_INFO } from '../lib/astroInfo'
import {
  BODY_INFO,
  ELEMENT_NAME,
  SIGN_ELEMENT,
  SIGN_GLYPHS,
  SIGNS,
  buildStarChart,
  progressions,
  toUtc,
  transits,
  type Overlay,
  type OverlayKind,
  formatCoords,
  formatLon,
  formatOffset,
  type Aspect,
  type ChartPoint,
  type Element,
  type StarChart,
  type StarPlace,
  type StarSettings,
} from '../lib/astrology'
import type { BaziInput } from '../lib/bazi'
import { CITIES } from '../lib/solarTime'
import { WORLD_CITIES, allTimeZones } from '../lib/worldCities'
import { STAR_SCHOOLS, cityPlace } from '../lib/starPrefs'
import { BirthForm } from './BirthForm'
import { InfoTip, TipLine } from './InfoTip'
import { TitleMark } from './Logo'
import { smoothUpdate } from './smoothUpdate'
import { SchoolSettingsPanel } from './Schools'
import { SectionNav } from './SectionNav'
import { SkyView } from './SkyView'

interface Props {
  input: BaziInput
  onChange: (input: BaziInput) => void
  place: StarPlace
  onPlaceChange: (place: StarPlace) => void
  settings: StarSettings
  onSettingsChange: (settings: StarSettings) => void
}

/** 西洋占星 natal chart: the shared birth form, a birthplace, the wheel and the tables. */
export function StarChartView({ input, onChange, place, onPlaceChange, settings, onSettingsChange }: Props) {
  const chart = useMemo(() => buildStarChart(input, place, settings), [input, place, settings])
  // 行运 / 推运: a moment to compare with the natal chart, read in the birthplace's time zone.
  const [mode, setMode] = useState<'natal' | OverlayKind>('natal')
  const [when, setWhen] = useState(nowLocal)
  // Highlight: a house, or a planet (with the planets it aspects). Mouse hover, or tap / focus.
  const [focus, setFocus] = useState<Focus>(null)
  const hover = (f: NonNullable<Focus>) => ({
    tabIndex: 0,
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === 'mouse' && setFocus(f),
    onPointerLeave: (e: React.PointerEvent) => e.pointerType === 'mouse' && setFocus(null),
    onFocus: () => setFocus(f),
    onBlur: () => setFocus(null),
  })
  const overlay = useMemo<Overlay | null>(() => {
    if (mode === 'natal') return null
    const [y, m, d] = when.date.split('-').map(Number)
    const [hh, mm] = when.time.split(':').map(Number)
    if (!y || !m || !d) return null
    const target = toUtc({ year: y, month: m, day: d, hour: hh || 0, minute: mm || 0 }, place.timeZone).date
    if (target.getTime() <= chart.utc.getTime()) return null
    return mode === 'transit' ? transits(chart, target, settings) : progressions(chart, target, settings)
  }, [mode, when, chart, place.timeZone, settings])
  const hl = useMemo(() => highlight(chart, overlay, focus), [chart, overlay, focus])
  const byKey = (k: ChartPoint['key']) => chart.points.find((p) => p.key === k)!
  const sun = byKey('sun')
  const moon = byKey('moon')
  const asc = byKey('asc')
  const bodies = chart.points.filter((p) => p.key !== 'asc' && p.key !== 'mc')
  // Element balance over the ten planets
  const elements = (['fire', 'earth', 'air', 'water'] as Element[]).map((e) => ({
    e,
    n: bodies.filter((p) => p.key !== 'node' && p.key !== 'southNode' && SIGN_ELEMENT[p.sign] === e).length,
  }))

  return (
    <div className="bazi-layout">
      <BirthForm
        input={input}
        onChange={onChange}
        trueSolar={false}
        extra={<PlacePicker place={place} onChange={onPlaceChange} />}
        schoolsPanel={<SchoolSettingsPanel registry={STAR_SCHOOLS} settings={settings} onChange={onSettingsChange} />}
      />
      <SectionNav
        items={[
          ['star-natal', '本命'],
          ...(overlay ? [['star-overlay', overlay.kind === 'transit' ? '行运' : '推运'] as [string, string]] : []),
          ['star-houses', '宫位'],
          ['star-sky', '天空'],
        ]}
      />

      <section className="card" id="star-natal">
        <div className="big-three">
          {[
            [sun, '太阳'],
            [moon, '月亮'],
            [asc, '上升'],
          ].map(([p, label]) => {
            const pt = p as ChartPoint
            return (
              <div key={label as string} className={`b3 el-${SIGN_ELEMENT[pt.sign]}`}>
                <small className="muted">{label as string}</small>
                <span className="b3-glyph">{SIGN_GLYPHS[pt.sign]}</span>
                <strong>{SIGNS[pt.sign]}座</strong>
              </div>
            )
          })}
        </div>
        <p className="muted row-note star-meta">
          {place.name}（{formatCoords(place.latitude, place.longitude)}）· 按出生地时间{' '}
          {formatOffset(chart.offsetMinutes)}
          {chart.dst && '（当时实行夏令时，已换算）'} · 回归黄道 ·{' '}
          {STAR_SCHOOLS.houses.options.find((o) => o.value === settings.houses)?.label}
          {chart.housesFallback && '（极圈内无法使用普拉西度，已改用等宫制）'}
        </p>
        <div className="overlay-bar">
          <div className="seg small" role="group" aria-label="比较盘">
            {(
              [
                ['natal', '本命'],
                ['transit', '行运'],
                ['progressed', '推运'],
              ] as const
            ).map(([v, label]) => (
              <button key={v} className={mode === v ? 'on' : undefined} onClick={() => mode !== v && smoothUpdate('star', () => setMode(v))}>
                {label}
              </button>
            ))}
          </div>
          {mode !== 'natal' && (
            <>
              <input
                type="date"
                aria-label="日期"
                value={when.date}
                min="1900-01-01"
                max="2100-12-31"
                onChange={(e) => e.target.value && setWhen({ ...when, date: e.target.value })}
              />
              <input
                type="time"
                aria-label="时间"
                value={when.time}
                onChange={(e) => e.target.value && setWhen({ ...when, time: e.target.value })}
              />
              <button type="button" className="ghost" onClick={() => setWhen(nowLocal())}>
                现在
              </button>
            </>
          )}
        </div>
        {mode !== 'natal' && !overlay && <p className="muted row-note">请选择出生之后的日期。</p>}
        <div className="star-layout">
          <StarWheel chart={chart} overlay={overlay} hl={hl} hover={hover} />
          <div className="star-tables">
            <table className="star-table">
              <thead>
                <tr>
                  <th>星体</th>
                  <th>位置</th>
                  <th>宫</th>
                </tr>
              </thead>
              <tbody>
                {chart.points.map((p) => (
                  <tr
                    key={p.key}
                    className={hl.row(p) ? 'on' : undefined}
                    {...hover({ planet: p.key, layer: 'natal' })}
                  >
                    <td>
                      <span className="planet-glyph">{p.key === 'asc' || p.key === 'mc' ? '' : p.glyph}</span>
                      <InfoTip label={p.name} title={p.name}>
                        <span>{PLANET_INFO[p.key]}</span>
                      </InfoTip>
                      {p.retrograde && (
                        <InfoTip className="plain retro" label="℞" title="逆行">
                          <span>从地球看，这颗行星正在黄道上倒退。传统上认为它的作用更内省、迟缓或需要回顾。</span>
                        </InfoTip>
                      )}
                    </td>
                    <td className={`el-${SIGN_ELEMENT[p.sign]}`}>
                      <InfoTip label={formatLon(p.lon)} title={`${SIGNS[p.sign]}座 ${SIGN_GLYPHS[p.sign]}`}>
                        <TipLine name={ELEMENT_NAME[SIGN_ELEMENT[p.sign]]}>{SIGN_INFO[p.sign]}</TipLine>
                      </InfoTip>
                    </td>
                    <td>
                      <InfoTip label={String(p.house)} title={`第${p.house}宫`}>
                        <span>{HOUSE_INFO[p.house - 1]}</span>
                      </InfoTip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="element-bars">
              {elements.map(({ e, n }) => (
                <span key={e} className={`el-${e}`}>
                  {ELEMENT_NAME[e]} <b>{n}</b>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {overlay && <OverlayCard overlay={overlay} timeZone={place.timeZone} hl={hl} hover={hover} active={!!focus} />}

      <section className="card" id="star-houses">
        <h3 className="section-title">
          <TitleMark />
          宫位
        </h3>
        <div className="house-grid">
          {chart.cusps.map((c, i) => (
            <div key={i} className={`house-cell${hl.house === i + 1 ? ' on' : ''}`} {...hover({ house: i + 1 })}>
              <InfoTip label={`第${i + 1}宫`} title={`第${i + 1}宫`}>
                <span>{HOUSE_INFO[i]}</span>
              </InfoTip>
              <span className={`el-${SIGN_ELEMENT[Math.floor(c / 30)]}`}>{formatLon(c)}</span>
            </div>
          ))}
        </div>

        <h3 className="section-title aspects-title">
          <TitleMark />
          相位
        </h3>
        {chart.aspects.length === 0 ? (
          <p className="muted">没有主要相位。</p>
        ) : (
          <div className={`aspect-list${focus ? ' has-focus' : ''}`}>
            {chart.aspects.map((a) => (
              <span key={a.a.key + a.b.key} className={`aspect-chip tone-${a.type.tone}${hl.aspect(a) ? ' on' : ''}`}>
                {a.a.name}
                <InfoTip className="plain" label={`${a.type.glyph}${a.type.name}`} title={`${a.type.name}相`}>
                  <span>{ASPECT_INFO[a.type.key]}</span>
                </InfoTip>
                {a.b.name}
                <small>{a.orb.toFixed(1)}°</small>
              </span>
            ))}
          </div>
        )}
        <p className="muted row-note">
          容许度：合、冲 8°，刑、拱 7°，六合 5°，涉及日月再加 2°。星体位置由{' '}
          <a href="https://github.com/cosinekitty/astronomy">astronomy-engine</a> 计算（误差约 1′）·{' '}
          <a href="https://github.com/RedCarpG/web-paipan-ChroniQ/blob/main/docs/schools.md#星盘">宫位制说明</a> ·
          仅供参考
        </p>
      </section>

      <SkyView place={place} />
    </div>
  )
}

/** Birthplace for houses and the time zone: a city (China or overseas), or custom coordinates and zone. */
function PlacePicker({ place, onChange }: { place: StarPlace; onChange: (p: StarPlace) => void }) {
  const known = findCity(place.name)
  const custom = !known
  const zones = useMemo(allTimeZones, [])
  return (
    <>
      <label>
        出生地
        <select
          value={custom ? '' : place.name}
          onChange={(e) => {
            const c = findCity(e.target.value)
            if (c) onChange(cityPlace(c))
            else onChange({ ...place, name: '自定义' })
          }}
        >
          <optgroup label="中国">
            {CITIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </optgroup>
          {WORLD_CITIES.map((r) => (
            <optgroup key={r.region} label={r.region}>
              {r.cities.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
          <option value="">自定义经纬度…</option>
        </select>
      </label>
      {custom && (
        <>
          <label>
            纬度（南为负）
            <input
              type="number"
              className="narrow"
              min={-90}
              max={90}
              step={0.01}
              value={place.latitude}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (e.target.value !== '' && Math.abs(v) <= 90) onChange({ ...place, latitude: v })
              }}
            />
          </label>
          <label>
            经度（西为负）
            <input
              type="number"
              className="narrow"
              min={-180}
              max={180}
              step={0.01}
              value={place.longitude}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (e.target.value !== '' && Math.abs(v) <= 180) onChange({ ...place, longitude: v })
              }}
            />
          </label>
          <label>
            时区
            <select value={place.timeZone} onChange={(e) => onChange({ ...place, timeZone: e.target.value })}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </>
  )
}

const findCity = (name: string) =>
  CITIES.find((c) => c.name === name) ?? WORLD_CITIES.flatMap((r) => r.cities).find((c) => c.name === name)

/* ---------- The wheel ---------- */

const C = 200
const R_OUT = 196
const R_SIGN = 166
const R_HOUSE = 146
const R_PLANET = 124
const R_DEG = 104
const R_ASPECT = 90
const R_OUTER = 228
const R_OUTER_PLANET = 213

/**
 * Traditional orientation: the ascendant at nine o'clock, signs running
 * counter-clockwise, so houses 1–6 sit below the horizon.
 */
function StarWheel({
  chart,
  overlay,
  hl,
  hover,
}: {
  chart: StarChart
  overlay: Overlay | null
  hl: Highlight
  hover: (f: NonNullable<Focus>) => Record<string, unknown>
}) {
  const at = (lon: number, r: number) => {
    const d = ((lon - chart.asc) * Math.PI) / 180
    return [C - r * Math.cos(d), C + r * Math.sin(d)] as const
  }
  const arc = (from: number, to: number, r1: number, r2: number) => {
    const [x1, y1] = at(from, r1)
    const [x2, y2] = at(to, r1)
    const [x3, y3] = at(to, r2)
    const [x4, y4] = at(from, r2)
    // Increasing longitude runs counter-clockwise on screen (sweep flag 0).
    return `M${x1},${y1} A${r1},${r1} 0 0 0 ${x2},${y2} L${x3},${y3} A${r2},${r2} 0 0 1 ${x4},${y4}Z`
  }
  const planets = chart.points.filter((p) => p.key !== 'asc' && p.key !== 'mc')
  const shown = spread(
    planets.map((p) => p.lon),
    7.5,
  )
  // With 行运 / 推运, their bodies sit on an outer ring and the lines show their aspects to the natal chart.
  const outer = overlay?.points.filter((p) => p.key !== 'southNode') ?? []
  const outerShown = spread(
    outer.map((p) => p.lon),
    7,
  )
  const angles = new Set(['asc', 'mc'])
  const lines = overlay
    ? overlay.aspects.filter((a) => a.type.key !== 'conjunction' && !angles.has(a.a.key) && !angles.has(a.b.key))
    : chart.aspects.filter((a) => a.type.key !== 'conjunction' && !angles.has(a.a.key) && !angles.has(a.b.key))
  const pad = overlay ? 34 : 0

  return (
    <svg
      className={`star-wheel${overlay ? ` with-${overlay.kind}` : ''}${hl.active ? ' has-focus' : ''}`}
      viewBox={`${-pad} ${-pad} ${400 + pad * 2} ${400 + pad * 2}`}
      role="img"
      aria-label="星盘"
    >
      {overlay && <circle cx={C} cy={C} r={R_OUTER} className="outer-band" />}
      {SIGNS.map((name, i) => {
        const el = SIGN_ELEMENT[i]
        const [gx, gy] = at(i * 30 + 15, (R_OUT + R_SIGN) / 2)
        return (
          <g key={name} className={`sign el-${el}`}>
            <path d={arc(i * 30, i * 30 + 30, R_OUT, R_SIGN)} className={`sign-band band-${el}`}>
              <title>{name}座</title>
            </path>
            <text x={gx} y={gy} className="sign-glyph" textAnchor="middle" dominantBaseline="central">
              {SIGN_GLYPHS[i]}
            </text>
          </g>
        )
      })}
      {Array.from({ length: 72 }, (_, i) => {
        const [x1, y1] = at(i * 5, R_SIGN)
        const [x2, y2] = at(i * 5, R_SIGN - (i % 2 ? 3 : 6))
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="tick" />
      })}
      <circle cx={C} cy={C} r={R_SIGN} className="ring" />
      <circle cx={C} cy={C} r={R_HOUSE} className="ring faint" />
      <circle cx={C} cy={C} r={R_ASPECT} className="ring" />
      {chart.cusps.map((c, i) => (
        <path
          key={`sector-${i}`}
          d={arc(c, chart.cusps[(i + 1) % 12], R_SIGN, R_ASPECT)}
          className={`house-sector${hl.house === i + 1 ? ' on' : ''}`}
          aria-label={`第${i + 1}宫`}
          {...hover({ house: i + 1 })}
        />
      ))}
      {chart.cusps.map((c, i) => {
        const angle = i % 3 === 0
        const [x1, y1] = at(c, R_ASPECT)
        const [x2, y2] = at(c, R_SIGN)
        const next = chart.cusps[(i + 1) % 12]
        const mid = c + ((next - c + 360) % 360 || 30) / 2
        const [nx, ny] = at(mid, (R_SIGN + R_HOUSE) / 2)
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} className={angle ? 'cusp angle' : 'cusp'} />
            <text
              x={nx}
              y={ny}
              className={`house-num${hl.house === i + 1 ? ' on' : ''}`}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {i + 1}
            </text>
          </g>
        )
      })}
      {(['asc', 'mc'] as const).map((k) => {
        const lon = k === 'asc' ? chart.asc : chart.mc
        const [x, y] = at(lon, R_OUT + 1)
        return (
          <text key={k} x={x} y={y} className="angle-label" textAnchor="middle" dominantBaseline="central">
            {k === 'asc' ? 'AC' : 'MC'}
          </text>
        )
      })}
      {lines.map((a) => {
        const [x1, y1] = at(a.a.lon, R_ASPECT)
        const [x2, y2] = at(a.b.lon, R_ASPECT)
        return (
          <line
            key={a.a.key + a.b.key}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className={`aspect-line tone-${a.type.tone}${(overlay ? hl.cross(a) : hl.aspect(a)) ? ' on' : ''}`}
            strokeOpacity={Math.max(0.25, 1 - a.orb / (overlay ? 2.5 : 8))}
          >
            <title>
              {a.a.name}
              {a.type.name}
              {a.b.name}（{a.orb.toFixed(1)}°）
            </title>
          </line>
        )
      })}
      {planets.map((p, i) => {
        const [tx, ty] = at(p.lon, R_HOUSE)
        const [lx, ly] = at(p.lon, R_HOUSE - 5)
        const [px, py] = at(shown[i], R_PLANET)
        const [dx, dy] = at(shown[i], R_DEG)
        return (
          <g
            key={p.key}
            className={`planet el-${SIGN_ELEMENT[p.sign]}${hl.planet(p) ? ' on' : ''}`}
            {...hover({ planet: p.key, layer: 'natal' })}
          >
            <title>
              {p.name} {formatLon(p.lon)}
              {p.retrograde ? ' 逆行' : ''} · 第{p.house}宫
            </title>
            <line x1={tx} y1={ty} x2={lx} y2={ly} className="planet-tick" />
            <text x={px} y={py} className="planet-glyph-svg" textAnchor="middle" dominantBaseline="central">
              {BODY_INFO[p.key as keyof typeof BODY_INFO].glyph}
            </text>
            <text x={dx} y={dy} className="planet-deg" textAnchor="middle" dominantBaseline="central">
              {Math.floor(p.lon % 30)}°{p.retrograde ? '℞' : ''}
            </text>
          </g>
        )
      })}
      {outer.map((p, i) => {
        const [tx, ty] = at(p.lon, R_OUT)
        const [lx, ly] = at(p.lon, R_OUT + 5)
        const [px, py] = at(outerShown[i], R_OUTER_PLANET)
        const isAngle = angles.has(p.key)
        return (
          <g
            key={p.key}
            className={`outer-planet${hl.outer(p) ? ' on' : ''}`}
            {...hover({ planet: p.key, layer: 'overlay' })}
          >
            <title>
              {overlay!.kind === 'transit' ? '行运' : '推运'}
              {p.name} {formatLon(p.lon)}
              {p.retrograde ? ' 逆行' : ''} · 本命第{p.house}宫
            </title>
            <line x1={tx} y1={ty} x2={lx} y2={ly} className="planet-tick" />
            <text
              x={px}
              y={py}
              className={isAngle ? 'outer-angle' : 'planet-glyph-svg'}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {isAngle ? (p.key === 'asc' ? 'AC' : 'MC') : p.glyph}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Push crowded longitudes apart (circularly) so glyphs don't overlap; returns display longitudes in input order. */
function spread(lons: number[], gap: number): number[] {
  const order = lons.map((l, i) => ({ l, i, d: l })).sort((a, b) => a.l - b.l)
  for (let pass = 0; pass < 60; pass++) {
    let moved = false
    for (let k = 0; k < order.length; k++) {
      const a = order[k]
      const b = order[(k + 1) % order.length]
      const diff = (((b.d - a.d) % 360) + 360) % 360
      if (order.length > 1 && diff < gap) {
        const push = (gap - diff) / 2
        a.d -= push
        b.d += push
        moved = true
      }
    }
    if (!moved) break
  }
  const out: number[] = []
  for (const o of order) out[o.i] = o.d
  return out
}

/** Today, now, as date / time input values (browser local time). */
function nowLocal() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
  }
}

/** 行运 / 推运 positions and their aspects to the natal chart. */
function OverlayCard({
  overlay: o,
  timeZone,
  hl,
  hover,
  active,
}: {
  overlay: Overlay
  timeZone: string
  hl: Highlight
  hover: (f: NonNullable<Focus>) => Record<string, unknown>
  active: boolean
}) {
  const label = o.kind === 'transit' ? '行运' : '推运'
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('zh-CN', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(d)
  return (
    <section className={`card overlay-card is-${o.kind}`} id="star-overlay">
      <h3 className="section-title">
        <TitleMark />
        {label} · {fmt(o.target)}
      </h3>
      <p className="muted row-note">
        {o.kind === 'transit'
          ? `此刻行星在天上的位置（${o.age.toFixed(1)} 岁），对照本命盘看它们落在哪一宫、与本命星体形成什么相位。`
          : `二次推运：出生后一天对应人生一年。${o.age.toFixed(1)} 岁对应 ${fmt(o.progressedUtc!)} 的天象，上升、天顶按流派设置推进。`}
        容许度 {o.kind === 'transit' ? '2°' : '1°'}。
      </p>
      <div className="star-layout">
        <table className="star-table">
          <thead>
            <tr>
              <th>{label}</th>
              <th>位置</th>
              <th>本命宫</th>
            </tr>
          </thead>
          <tbody>
            {o.points.map((p) => (
              <tr
                key={p.key}
                className={hl.outerRow(p) ? 'on' : undefined}
                {...hover({ planet: p.key, layer: 'overlay' })}
              >
                <td>
                  <span className="planet-glyph">{p.key === 'asc' || p.key === 'mc' ? '' : p.glyph}</span>
                  <InfoTip label={p.name} title={p.name}>
                    <span>{PLANET_INFO[p.key]}</span>
                  </InfoTip>
                  {p.retrograde && <span className="retro">℞</span>}
                </td>
                <td className={`el-${SIGN_ELEMENT[p.sign]}`}>{formatLon(p.lon)}</td>
                <td>
                  <InfoTip label={String(p.house)} title={`第${p.house}宫`}>
                    <span>{HOUSE_INFO[p.house - 1]}</span>
                  </InfoTip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <h4 className="overlay-subtitle">
            <TitleMark />
            与本命的相位
          </h4>
          {o.aspects.length === 0 ? (
            <p className="muted">容许度内没有相位。</p>
          ) : (
            <div className={`aspect-list${active ? ' has-focus' : ''}`}>
              {o.aspects.map((a) => (
                <span key={a.a.key + a.b.key} className={`aspect-chip tone-${a.type.tone}${hl.cross(a) ? ' on' : ''}`}>
                  {label}
                  {a.a.name}
                  <InfoTip className="plain" label={`${a.type.glyph}${a.type.name}`} title={`${a.type.name}相`}>
                    <span>{ASPECT_INFO[a.type.key]}</span>
                  </InfoTip>
                  本命{a.b.name}
                  <small>{a.orb.toFixed(2)}°</small>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/** What is highlighted: a house, or a planet of the natal chart or of the 行运 / 推运 overlay. */
type Focus = { house: number } | { planet: string; layer: 'natal' | 'overlay' } | null

interface Highlight {
  active: boolean
  /** The house to light up: the focused one, or the focused planet's (natal) house */
  house?: number
  /** Natal table rows: the focused planet, the planets in the focused house, or those an overlay planet aspects */
  row: (p: ChartPoint) => boolean
  /** Natal glyphs on the wheel: also the focused natal planet's aspect partners */
  planet: (p: ChartPoint) => boolean
  /** Natal-to-natal aspects */
  aspect: (a: Aspect) => boolean
  /** Overlay glyphs on the outer ring */
  outer: (p: ChartPoint) => boolean
  /** Overlay card rows */
  outerRow: (p: ChartPoint) => boolean
  /** Overlay-to-natal aspects (lines and chips); a = overlay end, b = natal end */
  cross: (a: Aspect) => boolean
}

const none = () => false

function highlight(chart: StarChart, overlay: Overlay | null, focus: Focus): Highlight {
  if (!focus) return { active: false, row: none, planet: none, aspect: none, outer: none, outerRow: none, cross: none }
  const cross = overlay?.aspects ?? []
  if ('house' in focus) {
    const h = focus.house
    return {
      active: true,
      house: h,
      row: (p) => p.house === h,
      planet: (p) => p.house === h,
      aspect: (a) => a.a.house === h || a.b.house === h,
      outer: (p) => p.house === h,
      outerRow: (p) => p.house === h,
      cross: (a) => a.a.house === h || a.b.house === h,
    }
  }
  const key = focus.planet
  if (focus.layer === 'overlay') {
    // An overlay planet: its natal house, the natal points it aspects, and those aspects.
    const natalPartners = new Set(cross.filter((a) => a.a.key === key).map((a) => a.b.key))
    return {
      active: true,
      house: overlay?.points.find((p) => p.key === key)?.house,
      row: (p) => natalPartners.has(p.key),
      planet: (p) => natalPartners.has(p.key),
      aspect: none,
      outer: (p) => p.key === key,
      outerRow: (p) => p.key === key,
      cross: (a) => a.a.key === key,
    }
  }
  // A natal planet: its house, its natal aspect partners, and the overlay planets aspecting it.
  const partners = new Set(
    chart.aspects.flatMap((a) => (a.a.key === key ? [a.b.key] : a.b.key === key ? [a.a.key] : [])),
  )
  const overlayPartners = new Set(cross.filter((a) => a.b.key === key).map((a) => a.a.key))
  return {
    active: true,
    house: chart.points.find((p) => p.key === key)?.house,
    row: (p) => p.key === key,
    planet: (p) => p.key === key || (!overlay && partners.has(p.key)),
    aspect: (a) => a.a.key === key || a.b.key === key,
    outer: (p) => overlayPartners.has(p.key),
    outerRow: (p) => overlayPartners.has(p.key),
    cross: (a) => a.b.key === key,
  }
}
