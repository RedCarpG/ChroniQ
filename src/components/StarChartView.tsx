import { useMemo, useState } from 'react'
import { ASPECT_INFO, HOUSE_INFO, PLANET_INFO, SIGN_INFO } from '../lib/astroInfo'
import {
  BODY_INFO,
  ELEMENT_NAME,
  SIGN_ELEMENT,
  SIGN_GLYPHS,
  SIGNS,
  buildStarChart,
  composite,
  progressions,
  synastry,
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
import { loadCharts, sameInput } from '../lib/savedCharts'
import { DEFAULT_PLACE } from '../lib/place'
import { STAR_SCHOOLS } from '../lib/starPrefs'
import { useSettings, useT } from '../settingsContext'
import { BirthForm, DateParts } from './BirthForm'
import { InfoTip, TipLine } from './InfoTip'
import { TitleMark } from './Logo'
import { smoothUpdate } from './smoothUpdate'
import { SchoolSettingsPanel } from './Schools'
import { SectionNav } from './SectionNav'
import { PlacePicker } from './PlacePicker'

type T = ReturnType<typeof useT>

/** Section title of each overlay */
const overlayTitle = (t: T, kind: OverlayKind) => (kind === 'transit' ? t('行运') : kind === 'progressed' ? t('推运') : t('合盘'))
/** Short name of each overlay, as a table heading */
const overlayLabel = (t: T, kind: OverlayKind) => (kind === 'transit' ? t('行运') : kind === 'progressed' ? t('推运') : t('对方'))
/** An overlay body by name: 行运金星, 推运金星, 对方金星 */
const overlayName = (t: T, kind: OverlayKind, name: string) =>
  kind === 'transit' ? t('行运{name}', { name }) : kind === 'progressed' ? t('推运{name}', { name }) : t('对方{name}', { name })
/** A natal body by name, as the other end of an overlay aspect: 本命太阳, 我的太阳 */
const natalName = (t: T, kind: OverlayKind, name: string) => (kind === 'synastry' ? t('我的{name}', { name }) : t('本命{name}', { name }))
/** 第1宫 … 第12宫 (each has its own entry: English uses ordinals) */
const houseName = (t: T, n: number) => t(`第${n}宫`)
/** 白羊座 */
const signName = (t: T, sign: number) => t('{sign}座', { sign: t(SIGNS[sign]) })
/** The default partner is called 对方; a saved chart keeps its own name. */
const partnerLabel = (t: T, name: string) => (name === '对方' ? t('对方') : name)

interface Props {
  input: BaziInput
  onChange: (input: BaziInput) => void
  settings: StarSettings
  onSettingsChange: (settings: StarSettings) => void
}

/** 西洋占星 natal chart: the shared birth form, a birthplace, the wheel and the tables. */
export function StarChartView({ input, onChange, settings, onSettingsChange }: Props) {
  const t = useT()
  // The chart's own birthplace, shared with 八字 / 紫微 and saved with the chart
  const place = input.place ?? DEFAULT_PLACE
  const chart = useMemo(() => buildStarChart(input, place, settings), [input, place, settings])
  // 行运 / 推运: a moment to compare with the natal chart, read in the birthplace's time zone.
  const [mode, setMode] = useState<'natal' | OverlayKind | 'composite'>('natal')
  const [when, setWhen] = useState(nowLocal)
  // 合盘: the other person, remembered between visits
  const [partner, setPartnerState] = useState<Partner>(() => loadPartner(input, place))
  const setPartner = (next: Partner) => {
    setPartnerState(next)
    savePartner(next)
  }
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
    if (mode === 'natal' || mode === 'composite') return null
    if (mode === 'synastry') return synastry(chart, buildStarChart(partner.wall, partner.place, settings))
    const [y, m, d] = when.date.split('-').map(Number)
    const [hh, mm] = when.time.split(':').map(Number)
    if (!y || !m || !d) return null
    const target = toUtc({ year: y, month: m, day: d, hour: hh || 0, minute: mm || 0 }, place.timeZone).date
    if (target.getTime() <= chart.utc.getTime()) return null
    return mode === 'transit' ? transits(chart, target, settings) : progressions(chart, target, settings)
  }, [mode, when, chart, place.timeZone, settings, partner])
  const hl = useMemo(() => highlight(chart, overlay, focus), [chart, overlay, focus])
  const compositeChart = useMemo(
    () =>
      mode === 'composite' ? composite(chart, buildStarChart(partner.wall, partner.place, settings), settings) : null,
    [mode, chart, partner, settings],
  )
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
        schoolsPanel={<SchoolSettingsPanel registry={STAR_SCHOOLS} settings={settings} onChange={onSettingsChange} />}
      />
      <SectionNav
        items={[
          ['star-natal', t('本命')],
          ...(overlay ? [['star-overlay', overlayTitle(t, overlay.kind)] as [string, string]] : []),
          ...(compositeChart ? [['star-composite', t('组合盘')] as [string, string]] : []),
          ['star-houses', t('宫位')],
        ]}
      />

      <section className="card" id="star-natal">
        <div className="big-three">
          {[
            [sun, t('太阳')],
            [moon, t('月亮')],
            [asc, t('上升')],
          ].map(([p, label]) => {
            const pt = p as ChartPoint
            return (
              <div key={label as string} className={`b3 el-${SIGN_ELEMENT[pt.sign]}`}>
                <small className="muted">{label as string}</small>
                <span className="b3-glyph">{SIGN_GLYPHS[pt.sign]}</span>
                <strong>{signName(t, pt.sign)}</strong>
              </div>
            )
          })}
        </div>
        <p className="muted row-note star-meta">
          {t('{place}（{coords}）· 按出生地时间 {offset}', {
            place: t(place.name),
            coords: formatCoords(place.latitude, place.longitude),
            offset: formatOffset(chart.offsetMinutes),
          })}
          {chart.dst && t('（当时实行夏令时，已换算）')} · {t('回归黄道')} ·{' '}
          {t(STAR_SCHOOLS.houses.options.find((o) => o.value === settings.houses)?.label ?? '')}
          {chart.housesFallback && t('（极圈内无法使用普拉西度，已改用等宫制）')}
        </p>
        <div className="overlay-bar">
          <div className="seg small" role="group" aria-label={t('比较盘')}>
            {(
              [
                ['natal', t('本命')],
                ['transit', t('行运')],
                ['progressed', t('推运')],
                ['synastry', t('合盘')],
                ['composite', t('组合盘')],
              ] as const
            ).map(([v, label]) => (
              <button key={v} className={mode === v ? 'on' : undefined} onClick={() => mode !== v && smoothUpdate('star', () => setMode(v))}>
                {label}
              </button>
            ))}
          </div>
          {(mode === 'transit' || mode === 'progressed') && (
            <>
              <input
                type="date"
                aria-label={t('日期')}
                value={when.date}
                min="1900-01-01"
                max="2100-12-31"
                onChange={(e) => e.target.value && setWhen({ ...when, date: e.target.value })}
              />
              <input
                type="time"
                aria-label={t('时间')}
                value={when.time}
                onChange={(e) => e.target.value && setWhen({ ...when, time: e.target.value })}
              />
              <button type="button" className="ghost" onClick={() => setWhen(nowLocal())}>
                {t('现在')}
              </button>
            </>
          )}
        </div>
        {(mode === 'synastry' || mode === 'composite') && <PartnerPicker partner={partner} onChange={setPartner} input={input} />}
        {(mode === 'transit' || mode === 'progressed') && !overlay && (
          <p className="muted row-note">{t('请选择出生之后的日期。')}</p>
        )}
        <div className="star-layout">
          <StarWheel chart={chart} overlay={overlay} hl={hl} hover={hover} />
          <div className="star-tables">
            <PointTable chart={chart} hl={hl} hover={hover} />
            <div className="element-bars">
              {elements.map(({ e, n }) => (
                <span key={e} className={`el-${e}`}>
                  {t(ELEMENT_NAME[e])} <b>{n}</b>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {overlay && (
        <OverlayCard
          overlay={overlay}
          timeZone={place.timeZone}
          partnerName={partnerLabel(t, partner.name)}
          hl={hl}
          hover={hover}
          active={!!focus}
        />
      )}

      {compositeChart && <CompositeCard chart={compositeChart} partnerName={partnerLabel(t, partner.name)} settings={settings} />}

      <section className="card" id="star-houses">
        <h3 className="section-title">
          <TitleMark />
          {t('宫位')}
        </h3>
        <div className="house-grid">
          {chart.cusps.map((c, i) => (
            <div key={i} className={`house-cell${hl.house === i + 1 ? ' on' : ''}`} {...hover({ house: i + 1 })}>
              <InfoTip label={houseName(t, i + 1)} title={houseName(t, i + 1)}>
                <span>{HOUSE_INFO[i]}</span>
              </InfoTip>
              <span className={`el-${SIGN_ELEMENT[Math.floor(c / 30)]}`}>{formatLon(c, t)}</span>
            </div>
          ))}
        </div>

        <h3 className="section-title aspects-title">
          <TitleMark />
          {t('相位')}
        </h3>
        <AspectList aspects={chart.aspects} hl={hl} hover={hover} active={!!focus} />
        <p className="muted row-note">
          {t('容许度：合、冲 8°，刑、拱 7°，六合 5°，涉及日月再加 2°。')}
          {t('星体位置由')} <a href="https://github.com/cosinekitty/astronomy">astronomy-engine</a>{' '}
          {t('计算（误差约 1′）·')}{' '}
          <a href="https://github.com/RedCarpG/web-paipan-ChroniQ/blob/main/docs/schools.md#星盘">{t('宫位制说明')}</a> ·{' '}
          {t('仅供参考')}
        </p>
      </section>

    </div>
  )
}

/** Planet, sign position and house of each point in a chart. */
function PointTable({
  chart,
  hl,
  hover,
}: {
  chart: StarChart
  hl: Highlight
  hover: (f: NonNullable<Focus>) => Record<string, unknown>
}) {
  const t = useT()
  return (
    <table className="star-table">
      <thead>
        <tr>
          <th>{t('星体')}</th>
          <th>{t('位置')}</th>
          <th>{t('宫')}</th>
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
              <InfoTip label={t(p.name)} title={t(p.name)}>
                <span>{PLANET_INFO[p.key]}</span>
              </InfoTip>
              {p.retrograde && (
                <InfoTip className="plain retro" label="℞" title={t('逆行')}>
                  <span>从地球看，这颗行星正在黄道上倒退。传统上认为它的作用更内省、迟缓或需要回顾。</span>
                </InfoTip>
              )}
            </td>
            <td className={`el-${SIGN_ELEMENT[p.sign]}`}>
              <InfoTip label={formatLon(p.lon, t)} title={`${signName(t, p.sign)} ${SIGN_GLYPHS[p.sign]}`}>
                <TipLine name={t(ELEMENT_NAME[SIGN_ELEMENT[p.sign]])}>{SIGN_INFO[p.sign]}</TipLine>
              </InfoTip>
            </td>
            <td>
              <InfoTip label={String(p.house)} title={houseName(t, p.house)}>
                <span>{HOUSE_INFO[p.house - 1]}</span>
              </InfoTip>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Aspect chips within one chart. */
function AspectList({
  aspects,
  hl,
  hover,
  active,
}: {
  aspects: Aspect[]
  hl: Highlight
  hover: (f: NonNullable<Focus>) => Record<string, unknown>
  active: boolean
}) {
  const t = useT()
  return aspects.length === 0 ? (
    <p className="muted">{t('没有主要相位。')}</p>
  ) : (
    <div className={`aspect-list${active ? ' has-focus' : ''}`}>
      {aspects.map((a) => (
        <span
          key={a.a.key + a.b.key}
          className={`aspect-chip tone-${a.type.tone}${hl.aspect(a) ? ' on' : ''}`}
          {...hover({ aspect: a, cross: false })}
        >
          {t(a.a.name)}
          <InfoTip className="plain" label={aspectChip(t, a)} title={t(`${a.type.name}相`)}>
            <span>{ASPECT_INFO[a.type.key]}</span>
          </InfoTip>
          {t(a.b.name)}
          <small>{a.orb.toFixed(1)}°</small>
        </span>
      ))}
    </div>
  )
}

/** ☌合: an aspect's glyph and name (合相 … have their own entries, as titles) */
const aspectChip = (t: T, a: Aspect) => t('{glyph}{name}', { glyph: a.type.glyph, name: t(a.type.name) })

/**
 * 组合盘: the relationship's own chart, with its own wheel, positions and
 * aspects, and its own highlight (its planets are not the natal ones).
 */
function CompositeCard({ chart, partnerName, settings }: { chart: StarChart; partnerName: string; settings: StarSettings }) {
  const t = useT()
  const { language } = useSettings()
  const [focus, setFocus] = useState<Focus>(null)
  const hover = (f: NonNullable<Focus>) => ({
    tabIndex: 0,
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === 'mouse' && setFocus(f),
    onPointerLeave: (e: React.PointerEvent) => e.pointerType === 'mouse' && setFocus(null),
    onFocus: () => setFocus(f),
    onBlur: () => setFocus(null),
  })
  const hl = useMemo(() => highlight(chart, null, focus), [chart, focus])
  const davison = settings.composite === 'davison'
  const sign = (k: string) => {
    const p = chart.points.find((x) => x.key === k)!
    return `${signName(t, p.sign)} · ${houseName(t, p.house)}`
  }
  return (
    <section className="card overlay-card is-composite" id="star-composite">
      <h3 className="section-title">
        <TitleMark />
        {t('组合盘 · 我 + {name}', { name: partnerName })}
      </h3>
      <p className="muted row-note">
        {davison
          ? t('时空中点盘：两人出生时刻的中点 {date}（世界时），两地中点 {coords} 上空的真实天象。', {
              date: new Intl.DateTimeFormat(language === 'en' ? 'en' : 'zh-CN', {
                timeZone: 'UTC',
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(chart.utc),
              coords: formatCoords(chart.place.latitude, chart.place.longitude),
            })
          : t('中点组合盘：每颗行星取两人位置的较近中点；天顶取两人天顶的中点，上升与宫位由它在两地平均纬度 {lat}° 推出。', {
              lat: chart.place.latitude.toFixed(2),
            })}
        {t('组合盘看的是「这段关系本身」的性格：太阳是关系的核心，月亮是相处的感受，上升是这对组合给外人的样子。可在流派设置中切换做法。')}
      </p>
      <div className="big-three small">
        <span>
          {t('太阳')} {sign('sun')}
        </span>
        <span>
          {t('月亮')} {sign('moon')}
        </span>
        <span>
          {t('上升')} {signName(t, Math.floor(chart.asc / 30))}
        </span>
      </div>
      <div className="star-layout">
        <StarWheel chart={chart} overlay={null} hl={hl} hover={hover} />
        <div className="star-tables">
          <PointTable chart={chart} hl={hl} hover={hover} />
        </div>
      </div>
      <h4 className="overlay-subtitle reverse-title">
        <TitleMark />
        {t('组合盘相位')}
      </h4>
      <AspectList aspects={chart.aspects} hl={hl} hover={hover} active={!!focus} />
    </section>
  )
}

/* ---------- 合盘: the other person ---------- */

interface Partner {
  /** Saved-chart name, or 对方 */
  name: string
  wall: { year: number; month: number; day: number; hour: number; minute: number }
  place: StarPlace
}

const PARTNER_KEY = 'chroniq-star-partner'

/** A saved chart as a partner, with its birthplace (北京 if it has none). */
function partnerFrom(name: string, input: BaziInput): Partner {
  const { year, month, day, hour, minute } = input
  return { name, wall: { year, month, day, hour, minute }, place: input.place ?? DEFAULT_PLACE }
}

/** The last partner, else the first saved chart that isn't the one on screen, else a placeholder. */
function loadPartner(input: BaziInput, place: StarPlace): Partner {
  try {
    const p = JSON.parse(localStorage.getItem(PARTNER_KEY) ?? 'null') as Partner | null
    const w = p?.wall
    if (
      p &&
      typeof p.name === 'string' &&
      w &&
      [w.year, w.month, w.day, w.hour, w.minute].every(Number.isInteger) &&
      w.year >= 1900 &&
      w.year <= 2100 &&
      p.place &&
      Number.isFinite(p.place.latitude) &&
      Number.isFinite(p.place.longitude) &&
      typeof p.place.timeZone === 'string'
    )
      return p
  } catch {
    // fall through
  }
  const other = loadCharts().find((c) => !sameInput(c.input, input))
  if (other) return partnerFrom(other.name, other.input)
  return { name: '对方', wall: { year: 1990, month: 1, day: 1, hour: 12, minute: 0 }, place }
}

function savePartner(p: Partner) {
  try {
    localStorage.setItem(PARTNER_KEY, JSON.stringify(p))
  } catch {
    // Storage unavailable: the partner lasts for this visit only.
  }
}

/** The other person for 合盘: pick a saved chart, or enter a birth date, time and place. */
function PartnerPicker({
  partner,
  onChange,
  input,
}: {
  partner: Partner
  onChange: (p: Partner) => void
  input: BaziInput
}) {
  const t = useT()
  const charts = useMemo(loadCharts, [])
  const pad = (n: number) => String(n).padStart(2, '0')
  const w = partner.wall
  const savedMatch = charts.find(
    (c) =>
      c.name === partner.name &&
      c.input.year === w.year &&
      c.input.month === w.month &&
      c.input.day === w.day &&
      c.input.hour === w.hour &&
      c.input.minute === w.minute,
  )
  const edit = (patch: Partial<Partner['wall']>) =>
    onChange({ ...partner, name: savedMatch ? '对方' : partner.name, wall: { ...w, ...patch } })
  return (
    <div className="bazi-form partner-form">
      <label>
        {t('对方')}
        <select
          value={savedMatch?.id ?? ''}
          onChange={(e) => {
            const c = charts.find((x) => x.id === e.target.value)
            if (c) onChange(partnerFrom(c.name, c.input))
          }}
        >
          <option value="">{charts.length ? t('手动输入') : t('手动输入（没有已保存的命盘）')}</option>
          {charts.map((c) => (
            <option key={c.id} value={c.id} disabled={sameInput(c.input, input)}>
              {c.name}
              {sameInput(c.input, input) ? t('（当前）') : ''}
            </option>
          ))}
        </select>
      </label>
      <DateParts label={t('对方出生日期')} value={w} onChange={(d) => edit(d)} />
      <label>
        {t('出生时间')}
        <input
          type="time"
          value={`${pad(w.hour)}:${pad(w.minute)}`}
          onChange={(e) => {
            const [h, mi] = e.target.value.split(':').map(Number)
            if (!Number.isNaN(h)) edit({ hour: h, minute: mi })
          }}
        />
      </label>
      <PlacePicker label={t('对方出生地')} place={partner.place} onChange={(place) => onChange({ ...partner, place })} />
    </div>
  )
}

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
  const t = useT()
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
      aria-label={t('星盘')}
    >
      {overlay && <circle cx={C} cy={C} r={R_OUTER} className="outer-band" />}
      {SIGNS.map((name, i) => {
        const el = SIGN_ELEMENT[i]
        const [gx, gy] = at(i * 30 + 15, (R_OUT + R_SIGN) / 2)
        return (
          <g key={name} className={`sign el-${el}`}>
            <path d={arc(i * 30, i * 30 + 30, R_OUT, R_SIGN)} className={`sign-band band-${el}`}>
              <title>{signName(t, i)}</title>
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
          aria-label={houseName(t, i + 1)}
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
        // A wide invisible stroke on top makes the thin line easy to hover.
        return (
          <g key={a.a.key + a.b.key} className="aspect" {...hover({ aspect: a, cross: !!overlay })}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={`aspect-line tone-${a.type.tone}${(overlay ? hl.cross(a) : hl.aspect(a)) ? ' on' : ''}`}
              strokeOpacity={Math.max(0.25, 1 - a.orb / (!overlay ? 8 : overlay.kind === 'synastry' ? 7 : 2.5))}
            />
            <line x1={x1} y1={y1} x2={x2} y2={y2} className="aspect-hit">
              <title>
                {t('{a}{aspect}{b}（{orb}°）', {
                  a: overlay ? overlayName(t, overlay.kind, t(a.a.name)) : t(a.a.name),
                  aspect: t(a.type.name),
                  b: overlay ? natalName(t, overlay.kind, t(a.b.name)) : t(a.b.name),
                  orb: a.orb.toFixed(1),
                })}
              </title>
            </line>
          </g>
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
              {t(p.name)} {retroLon(t, p)} · {houseName(t, p.house)}
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
              {overlayName(t, overlay!.kind, t(p.name))} {retroLon(t, p)} ·{' '}
              {overlay!.kind === 'synastry'
                ? t('落我的{house}', { house: houseName(t, p.house) })
                : t('本命{house}', { house: houseName(t, p.house) })}
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

/** 白羊 12°34′, with 逆行 after it when retrograde */
const retroLon = (t: T, p: ChartPoint) => (p.retrograde ? t('{lon} 逆行', { lon: formatLon(p.lon, t) }) : formatLon(p.lon, t))

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
  partnerName,
  hl,
  hover,
  active,
}: {
  overlay: Overlay
  timeZone: string
  partnerName?: string
  hl: Highlight
  hover: (f: NonNullable<Focus>) => Record<string, unknown>
  active: boolean
}) {
  const t = useT()
  const { language } = useSettings()
  const syn = o.kind === 'synastry'
  const fmt = (d: Date, tz = timeZone) =>
    new Intl.DateTimeFormat(language === 'en' ? 'en' : 'zh-CN', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }).format(d)
  const tones = (tone: string) => o.aspects.filter((a) => a.type.tone === tone).length
  return (
    <section className={`card overlay-card is-${o.kind}`} id="star-overlay">
      <h3 className="section-title">
        <TitleMark />
        {syn ? t('合盘 · {name}', { name: partnerName ?? t('对方') }) : `${overlayTitle(t, o.kind)} · ${fmt(o.target)}`}
      </h3>
      <p className="muted row-note">
        {syn
          ? t('对方生于 {date}（{place}）。外圈是对方的星体，看它们落在你的哪一宫、与你的星体形成什么相位；下方也列出你的星体落在对方的哪一宫。容许度：合、冲 6°，刑、拱 5°，六合 3°；天王、海王、冥王彼此之间的相位是同一代人共有的，不列出。', {
              date: fmt(o.target, o.partner!.place.timeZone),
              place: t(o.partner!.place.name),
            })
          : o.kind === 'transit'
            ? t('此刻行星在天上的位置（{age} 岁），对照本命盘看它们落在哪一宫、与本命星体形成什么相位。', { age: o.age.toFixed(1) })
            : t('二次推运：出生后一天对应人生一年。{age} 岁对应 {date} 的天象，上升、天顶按流派设置推进。', {
                age: o.age.toFixed(1),
                date: fmt(o.progressedUtc!),
              })}
        {!syn && t('容许度 {orb}。', { orb: o.kind === 'transit' ? '2°' : '1°' })}
      </p>
      <div className="star-layout">
        <table className="star-table">
          <thead>
            <tr>
              <th>{overlayLabel(t, o.kind)}</th>
              <th>{t('位置')}</th>
              <th>{syn ? t('落我宫') : t('本命宫')}</th>
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
                  <InfoTip label={t(p.name)} title={t(p.name)}>
                    <span>{PLANET_INFO[p.key]}</span>
                  </InfoTip>
                  {p.retrograde && <span className="retro">℞</span>}
                </td>
                <td className={`el-${SIGN_ELEMENT[p.sign]}`}>{formatLon(p.lon, t)}</td>
                <td>
                  <InfoTip label={String(p.house)} title={houseName(t, p.house)}>
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
            {syn ? t('双方相位') : t('与本命的相位')}
          </h4>
          {syn && o.aspects.length > 0 && (
            <p className="muted synastry-tally">
              <span className="tone-soft">{t('和谐 {n}', { n: tones('soft') })}</span> ·{' '}
              <span className="tone-hard">{t('紧张 {n}', { n: tones('hard') })}</span> ·{' '}
              <span>{t('合相 {n}', { n: tones('major') })}</span>
            </p>
          )}
          {o.aspects.length === 0 ? (
            <p className="muted">{t('容许度内没有相位。')}</p>
          ) : (
            <div className={`aspect-list${active ? ' has-focus' : ''}`}>
              {o.aspects.map((a) => (
                <span
                  key={a.a.key + a.b.key}
                  className={`aspect-chip tone-${a.type.tone}${hl.cross(a) ? ' on' : ''}`}
                  {...hover({ aspect: a, cross: true })}
                >
                  {overlayName(t, o.kind, t(a.a.name))}
                  <InfoTip className="plain" label={aspectChip(t, a)} title={t(`${a.type.name}相`)}>
                    <span>{ASPECT_INFO[a.type.key]}</span>
                  </InfoTip>
                  {natalName(t, o.kind, t(a.b.name))}
                  <small>{a.orb.toFixed(syn ? 1 : 2)}°</small>
                </span>
              ))}
            </div>
          )}
          {syn && (
            <>
              <h4 className="overlay-subtitle reverse-title">
                <TitleMark />
                {t('我的星体落在对方的宫位')}
              </h4>
              <div className="house-overlay">
                {o.inPartnerHouses!.map((p) => (
                  <span
                    key={p.key}
                    className={`ho-item${hl.row(p) ? ' on' : ''}`}
                    {...hover({ planet: p.key, layer: 'natal' })}
                  >
                    {t(p.name)}
                    <b>{p.house}</b>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * What is highlighted: a house, a planet of the natal chart or of the overlay
 * (行运 / 推运 / 合盘), or one aspect (within the chart, or overlay to natal).
 */
type Focus =
  | { house: number }
  | { planet: string; layer: 'natal' | 'overlay' }
  | { aspect: Aspect; cross: boolean }
  | null

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
  if ('aspect' in focus) {
    // One aspect: its line or chip, and the two points at its ends.
    const { a: from, b: to } = focus.aspect
    const same = (x: Aspect) => x.a.key === from.key && x.b.key === to.key
    if (focus.cross)
      return {
        active: true,
        row: (p) => p.key === to.key,
        planet: (p) => p.key === to.key,
        aspect: none,
        outer: (p) => p.key === from.key,
        outerRow: (p) => p.key === from.key,
        cross: same,
      }
    const ends = (p: ChartPoint) => p.key === from.key || p.key === to.key
    return { active: true, row: ends, planet: ends, aspect: same, outer: none, outerRow: none, cross: none }
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
