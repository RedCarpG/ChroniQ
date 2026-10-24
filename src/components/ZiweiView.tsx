import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { BaziInput } from '../lib/bazi'
import { ELEMENTS, formatTime } from '../lib/bazi'
import {
  BOARD,
  buildHoroscope,
  buildZiwei,
  dayInfo,
  daysInMonth,
  hourInfo,
  lunarToday,
  monthInfo,
  sanFangSiZheng,
  yearGanzhi,
  type HoroscopeTarget,
  type LayerKind,
  type ZiweiFly,
  type ZiweiLayer,
  type ZiweiPalace,
  type ZiweiStar,
} from '../lib/ziwei'
import { ZIWEI_SCHOOLS, type ZiweiSchoolSettings } from '../lib/ziweiSchools'
import { useSettings, useT, useTerm } from '../settingsContext'
import { BirthForm } from './BirthForm'
import { FortuneRow } from './FortuneRow'
import { TitleMark } from './Logo'
import { smoothUpdate } from './smoothUpdate'
import { SchoolSettingsPanel } from './Schools'
import { SectionNav } from './SectionNav'
import { SanFangTip, StarTip } from './ZiweiTips'

/** A palace's part in the selected palace's 三方四正 */
type Role = 'self' | 'opposite' | 'trine'

/** What hovering a palace shows: its 三方四正, or where its 天干 flies 四化 */
type BoardMode = 'sanfang' | 'feihua'
const MODE_KEY = 'chroniq-ziwei-mode'
function loadMode(): BoardMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'feihua' ? 'feihua' : 'sanfang'
  } catch {
    return 'sanfang'
  }
}

/** How many 运限 layers the board shows */
type Depth = 'natal' | LayerKind
const DEPTHS: { value: Depth; label: string }[] = [
  { value: 'natal', label: '本命' },
  { value: 'decadal', label: '大限' },
  { value: 'yearly', label: '流年' },
  { value: 'monthly', label: '流月' },
  { value: 'daily', label: '流日' },
  { value: 'hourly', label: '流时' },
]
const LAYER_ORDER: LayerKind[] = ['decadal', 'yearly', 'monthly', 'daily', 'hourly']
/** The 运限 row each layer is picked in */
const ROW_OF = { decadal: 'decade', yearly: 'year', monthly: 'month', daily: 'day', hourly: 'hour' } as const
const INITIAL_OPEN = { decade: true, year: false, month: false, day: false, hour: false }
/** One-character layer prefix: 大命, 年财, 月兄, 日福, 时官 … */
const LAYER_CHAR: Record<LayerKind, string> = { decadal: '大', yearly: '年', monthly: '月', daily: '日', hourly: '时' }
const LAYER_NAME: Record<LayerKind, string> = {
  decadal: '大限',
  yearly: '流年',
  monthly: '流月',
  daily: '流日',
  hourly: '流时',
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')
type ClockTime = { year: number; month: number; day: number; hour: number; minute: number }
/** A Gregorian date and time: 1990年5月15日 10:30, or 15 May 1990, 10:30 in English */
const solarText = (time: ClockTime, english: boolean) =>
  english
    ? `${time.day} ${MONTHS_EN[time.month - 1]} ${time.year}, ${pad(time.hour)}:${pad(time.minute)}`
    : formatTime(time)

/** Translated text with one {slot} filled by a React node (a link or a tip) */
function fill(text: string, slot: string, node: ReactNode) {
  const [before, after = ''] = text.split(`{${slot}}`)
  return (
    <>
      {before}
      {node}
      {after}
    </>
  )
}

interface Props {
  input: BaziInput
  onChange: (input: BaziInput) => void
  /** 紫微's own 流派设置, separate from 八字 */
  schools: ZiweiSchoolSettings
  onSchoolsChange: (schools: ZiweiSchoolSettings) => void
}

/** 紫微斗数 page: shared birth form plus the twelve-palace board. */
export function ZiweiView({ input, onChange, schools, onSchoolsChange }: Props) {
  const chart = useMemo(() => buildZiwei(input, schools), [input, schools])
  const term = useTerm()
  const t = useT()
  const { ziweiColor, language } = useSettings()
  const english = language === 'en'
  // The palace whose 三方四正 is shown (hover with a mouse, tap or focus otherwise)
  const [active, setActive] = useState<string | null>(null)
  const [mode, setModeState] = useState<BoardMode>(loadMode)
  const setMode = (next: BoardMode) => {
    setModeState(next)
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {
      // Storage unavailable: the choice lasts for this visit only.
    }
  }

  // 运限: picks default to the current 大限, year, month, day and 时辰; the board only
  // shows layers once one is chosen (or 叠加 is set).
  const today = useMemo(lunarToday, [])
  const currentDecade = Math.max(
    0,
    chart.decades.findIndex((d) => d.years.includes(today.year)),
  )
  const [depth, setDepth] = useState<Depth>('natal')
  const [pickedDecade, setPickedDecade] = useState<number | null>(null)
  const [pickedYear, setPickedYear] = useState<number | null>(null)
  const [pickedMonth, setPickedMonth] = useState<number | null>(null)
  const [pickedDay, setPickedDay] = useState<number | null>(null)
  const [pickedHour, setPickedHour] = useState<number | null>(null)
  const decadeIndex = pickedDecade ?? currentDecade
  const decade = chart.decades[decadeIndex]
  const year = pickedYear ?? (decade.years.includes(today.year) ? today.year : decade.years[0])
  const month = pickedMonth ?? (year === today.year ? today.month : 1)
  const isThisMonth = year === today.year && month === today.month
  const day = Math.min(pickedDay ?? (isThisMonth ? today.day : 1), daysInMonth(year, month))
  const isToday = isThisMonth && day === today.day
  const hour = pickedHour ?? (isToday ? today.hour : 0)
  const horoscope = useMemo(
    () => (depth === 'natal' ? null : buildHoroscope(input, schools, { year, month, day, hour })),
    [depth, input, schools, year, month, day, hour],
  )
  const layers: ZiweiLayer[] = horoscope
    ? LAYER_ORDER.slice(
        0,
        DEPTHS.findIndex((d) => d.value === depth),
      ).map((k) => horoscope[k])
    : []
  // The board starts at 本命 and 运限 are picked one level at a time, so only the
  // 大限 row starts open; picking a level opens the next one.
  const [open, setOpen] = useState(INITIAL_OPEN)
  const toggle = (key: keyof typeof open) => setOpen((o) => ({ ...o, [key]: !o[key] }))
  // Clicking the picked chip of a shown level again peels the board back to the
  // level above and shuts the finer rows; picking a level that was not shown
  // opens the next finer row to pick from.
  // The board crossfades its new or departing 运限 (styles.css: [data-vt='ziwei']).
  const choose = (kind: LayerKind, again: boolean, pick: () => void) =>
    smoothUpdate('ziwei', () => chooseNow(kind, again, pick))
  const chooseNow = (kind: LayerKind, again: boolean, pick: () => void) => {
    const i = LAYER_ORDER.indexOf(kind)
    if (again && shows(kind)) {
      setDepth(DEPTHS[i].value)
      setOpen((o) => {
        const next = { ...o }
        for (const k of LAYER_ORDER.slice(i + 1)) next[ROW_OF[k]] = false
        return next
      })
      return
    }
    const finer = LAYER_ORDER[i + 1]
    if (finer && !shows(kind)) setOpen((o) => ({ ...o, [ROW_OF[finer]]: true }))
    pick()
  }
  // Picking a coarser level resets the finer ones; picking any level shows it.
  const pickDecade = (i: number) =>
    choose('decadal', i === decadeIndex, () => {
      setPickedDecade(i)
      setPickedYear(null)
      setPickedMonth(null)
      setPickedDay(null)
      setPickedHour(null)
      setDepth('decadal')
    })
  const pickYear = (y: number) =>
    choose('yearly', y === year, () => {
      setPickedYear(y)
      setPickedMonth(null)
      setPickedDay(null)
      setPickedHour(null)
      setDepth('yearly')
    })
  const pickMonth = (m: number) =>
    choose('monthly', m === month, () => {
      setPickedMonth(m)
      setPickedDay(null)
      setPickedHour(null)
      setDepth('monthly')
    })
  const pickDay = (d: number) =>
    choose('daily', d === day, () => {
      setPickedDay(d)
      setPickedHour(null)
      setDepth('daily')
    })
  const pickHour = (h: number) =>
    choose('hourly', h === hour, () => {
      setPickedHour(h)
      setDepth('hourly')
    })
  const update = (next: BaziInput) => {
    setDepth('natal')
    setOpen(INITIAL_OPEN)
    setPickedDecade(null)
    setPickedYear(null)
    setPickedMonth(null)
    setPickedDay(null)
    setPickedHour(null)
    onChange(next)
  }
  const shows = (kind: LayerKind) => layers.some((l) => l.kind === kind)
  const roles = useMemo(() => {
    if (!active || mode !== 'sanfang') return null
    const { opposite, trines } = sanFangSiZheng(active)
    return new Map<string, Role>([
      [active, 'self'],
      [opposite, 'opposite'],
      [trines[0], 'trine'],
      [trines[1], 'trine'],
    ])
  }, [active, mode])
  // 四化飞星: the hovered palace's four 飞化, and the 禄权科忌 each palace receives from it
  const flies = mode === 'feihua' && active ? chart.palaces[active].flies : null
  const boardRef = useRef<HTMLDivElement>(null)
  const boardSize = useSize(boardRef)

  return (
    <div className="bazi-layout">
      <BirthForm
        input={input}
        onChange={update}
        schoolsPanel={<SchoolSettingsPanel registry={ZIWEI_SCHOOLS} settings={schools} onChange={onSchoolsChange} />}
      />
      <SectionNav
        items={[
          ['ziwei-board', t('盘面')],
          ['ziwei-fortune', term('运限')],
        ]}
      />
      <section className="card" id="ziwei-board">
        <div className="zw-toolbar">
          <div className="seg small" role="group" aria-label={t('宫位显示')}>
            {(
              [
                ['sanfang', '三方四正'],
                ['feihua', '四化飞星'],
              ] as const
            ).map(([value, label]) => (
              <button key={value} className={mode === value ? 'on' : undefined} onClick={() => setMode(value)}>
                {term(label)}
              </button>
            ))}
          </div>
        </div>
        <div className="ziwei-scroll">
          <div
            ref={boardRef}
            className={`ziwei-board color-${ziweiColor}${roles ? ' sf-active' : ''}${flies ? ' fx-active' : ''}`}
          >
            {Object.values(chart.palaces).map((p) => (
              <Palace
                key={p.branch}
                palace={p}
                role={roles?.get(p.branch)}
                fly={flies && (p.branch === active ? 'src' : flies.filter((f) => f.to === p.branch))}
                showSelf={mode === 'feihua'}
                layers={layers}
                onActive={setActive}
              />
            ))}
            {active && mode === 'sanfang' && <SanFangLines branch={active} />}
            {active && flies && boardSize && <FeiHuaLines from={active} flies={flies} size={boardSize} />}
            <div className="ziwei-center">
              <div className="zc-title">
                <strong>{chart.gender === '男' ? term('乾造') : term('坤造')}</strong>
                <span>{term(chart.fiveElementsClass)}</span>
              </div>
              <dl className="kv">
                <dt className="zc-extra">{t('阳历')}</dt>
                <dd className="zc-extra">{solarText(input, english)}</dd>
                {chart.trueSolar && (
                  <>
                    <dt>{t('真太阳时')}</dt>
                    <dd>{solarText(chart.trueSolar.time, english)}</dd>
                  </>
                )}
                <dt>{term('农历')}</dt>
                <dd>
                  {term(chart.lunarText)} {term(chart.time)}
                </dd>
                <dt>{term('四柱')}</dt>
                <dd>{chart.chineseDate}</dd>
                <dt>{term('命主')}</dt>
                <dd>{term(chart.soul)}</dd>
                <dt>{term('身主')}</dt>
                <dd>{term(chart.body)}</dd>
                {layers.map((l) => (
                  <LayerRow key={l.kind} layer={l} target={{ year, month, day, hour }} />
                ))}
                <dt className="zc-extra">{t('生肖 · 星座')}</dt>
                <dd className="zc-extra">
                  {term(chart.zodiac)} · {t(chart.sign)}
                </dd>
              </dl>
              {mode === 'feihua' ? (
                <FeiHuaSummary chart={chart} active={active} />
              ) : (
                <SanFangSummary chart={chart} active={active} />
              )}
            </div>
          </div>
        </div>
        <div className="zw-legends">
          {layers.length > 0 && (
            <div className="zc-legend">
              {layers.map((l) => (
                <span key={l.kind} className={`mutagen lm-${l.kind}`}>
                  {LAYER_NAME[l.kind]}
                </span>
              ))}
              <span className="muted">{t('运限四化、流耀与宫名')}</span>
            </div>
          )}
          <div className="zc-legend">
            {(['禄', '权', '科', '忌'] as const).map((m) => (
              <span key={m} className={`mutagen m-${m}`}>
                {term(m)}
              </span>
            ))}
            <span className="muted">{t('生年四化')}</span>
          </div>
          <div className="zc-legend">
            {ziweiColor === 'element' ? (
              ELEMENTS.map((e) => (
                <span key={e} className={`el-${e}`}>
                  {e}
                </span>
              ))
            ) : (
              <>
                <span className="luck-major">{t('主星')}</span>
                <span className="luck-good">{t('吉星')}</span>
                <span className="luck-bad">{t('煞星')}</span>
              </>
            )}
            <span className="muted">{t('星曜配色（可在设置中切换）')}</span>
          </div>
          {mode === 'feihua' && (
            <div className="zc-legend">
              <span className="mutagen fly self m-禄">↑{term('禄')}</span>
              <span className="muted">{t('宫干自化（离心）')}</span>
            </div>
          )}
          <div className="zc-legend muted">
            {mode === 'feihua' ? (
              <span>{t('悬停或点按宫位，看它的宫干把禄权科忌飞入哪一宫')}</span>
            ) : (
              <span>{fill(t('悬停或点按宫位看{tip}，悬停或点按星曜看解释'), 'tip', <SanFangTip />)}</span>
            )}
          </div>
        </div>
        <p className="muted row-note ziwei-credit">
          {fill(
            schools.algorithm === 'zhongzhou'
              ? t('命盘由 {iztro} 排出（中州派安星法）· 仅供参考')
              : t('命盘由 {iztro} 排出（通行版安星法）· 仅供参考'),
            'iztro',
            <a href="https://github.com/SylarLong/iztro">iztro</a>,
          )}
        </p>
      </section>

      <section className="card fortunes ziwei-fortunes" id="ziwei-fortune">
        <div className="fortunes-head">
          <h3>
            <TitleMark />
            {term('运限')}
          </h3>
          <div className="seg small" role="group" aria-label={t('叠加到')}>
            {DEPTHS.map((d) => (
              <button key={d.value} className={depth === d.value ? 'on' : undefined} onClick={() => smoothUpdate('ziwei', () => setDepth(d.value))}>
                {term(d.label)}
              </button>
            ))}
          </div>
        </div>
        <FortuneRow
          title={term('大限')}
          summary={`${t('{from}–{to}岁', { from: decade.range[0], to: decade.range[1] })} · ${decade.stem}${decade.branch} · ${term(decade.palace)}`}
          open={open.decade}
          onToggle={() => toggle('decade')}
        >
          <div className="fortune-row decades">
            {chart.decades.map((d, i) => (
              <button
                key={d.branch}
                className={[
                  'fortune',
                  i === currentDecade && 'current',
                  shows('decadal') && i === decadeIndex && 'selected',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => pickDecade(i)}
              >
                <small>
                  {d.range[0]}–{d.range[1]}
                </small>
                <small className="muted">{d.years[0]}</small>
                <strong>
                  {d.stem}
                  {d.branch}
                </strong>
                <small>{term(d.palace)}</small>
              </button>
            ))}
          </div>
        </FortuneRow>
        <FortuneRow
          title={term('流年')}
          summary={`${year} ${yearGanzhi(year)} · ${t('{age}岁', { age: year - chart.birthYear + 1 })}`}
          open={open.year}
          onToggle={() => toggle('year')}
        >
          <div className="fortune-row">
            {decade.years.map((y) => (
              <button
                key={y}
                className={['fortune', y === today.year && 'current', shows('yearly') && y === year && 'selected']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => pickYear(y)}
              >
                <small>{y}</small>
                <small className="muted">{t('{age}岁', { age: y - chart.birthYear + 1 })}</small>
                <strong>{yearGanzhi(y)}</strong>
              </button>
            ))}
          </div>
        </FortuneRow>
        <FortuneRow
          title={term('流月')}
          summary={`${term(monthInfo(year, month).name)} ${monthInfo(year, month).ganzhi}`}
          open={open.month}
          onToggle={() => toggle('month')}
        >
          <div className="fortune-row months">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const info = monthInfo(year, m)
              return (
                <button
                  key={m}
                  className={[
                    'fortune',
                    year === today.year && m === today.month && 'current',
                    shows('monthly') && m === month && 'selected',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => pickMonth(m)}
                >
                  <small>{term(info.name)}</small>
                  <strong>{info.ganzhi}</strong>
                </button>
              )
            })}
          </div>
        </FortuneRow>
        <FortuneRow
          title={term('流日')}
          summary={`${dayInfo(year, month, day).name} ${dayInfo(year, month, day).ganzhi}`}
          open={open.day}
          onToggle={() => toggle('day')}
        >
          <div className="fortune-row days">
            {Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map((d) => {
              const info = dayInfo(year, month, d)
              return (
                <button
                  key={d}
                  className={[
                    'fortune',
                    isThisMonth && d === today.day && 'current',
                    shows('daily') && d === day && 'selected',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => pickDay(d)}
                >
                  <small>{info.name}</small>
                  <strong>{info.ganzhi}</strong>
                </button>
              )
            })}
          </div>
        </FortuneRow>
        <FortuneRow
          title={term('流时')}
          summary={`${term(hourInfo(year, month, day, hour).name)} ${hourInfo(year, month, day, hour).ganzhi}`}
          open={open.hour}
          onToggle={() => toggle('hour')}
        >
          <div className="fortune-row months">
            {Array.from({ length: 12 }, (_, i) => i).map((h) => {
              const info = hourInfo(year, month, day, h)
              return (
                <button
                  key={h}
                  className={[
                    'fortune',
                    isToday && h === today.hour && 'current',
                    shows('hourly') && h === hour && 'selected',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => pickHour(h)}
                >
                  <small>{term(info.name)}</small>
                  <strong>{info.ganzhi}</strong>
                </button>
              )
            })}
          </div>
        </FortuneRow>
        <p className="muted row-note">
          {t('流年按{start}换年（可在流派设置中切换）；流月按 iztro 的斗君起月；流日、流时以农历日和时辰为准（子时取当日早子时）。', {
            start: term(schools.horoscopeDivide === 'exact' ? '立春' : '正月初一'),
          })}
        </p>
      </section>
    </div>
  )
}

/** Centre-panel line naming a 运限 layer, e.g. 流年 2026 丙午 */
function LayerRow({ layer: l, target: t }: { layer: ZiweiLayer; target: HoroscopeTarget }) {
  const term = useTerm()
  const when: Record<LayerKind, string> = {
    decadal: '',
    yearly: `${t.year} `,
    monthly: `${term(monthInfo(t.year, t.month).name)} `,
    daily: `${dayInfo(t.year, t.month, t.day).name} `,
    hourly: `${term(hourInfo(t.year, t.month, t.day, t.hour).name)} `,
  }
  return (
    <>
      <dt className={`fl-${l.kind}`}>{term(LAYER_NAME[l.kind])}</dt>
      <dd>
        {when[l.kind]}
        {l.stem}
        {l.branch}
      </dd>
    </>
  )
}

/** Where a palace's 三方四正 line meets the centre square, in board units (each palace is 1×1). */
function anchor(branch: string): [number, number] {
  const [row, col] = BOARD[branch]
  const clamp = (n: number) => Math.min(Math.max(n, 1), 3)
  return [clamp(col - 0.5), clamp(row - 0.5)]
}

/** Lines across the centre: a triangle for the 三合 and a line to the 对宫. */
function SanFangLines({ branch }: { branch: string }) {
  const { opposite, trines } = sanFangSiZheng(branch)
  const [self, opp, t1, t2] = [branch, opposite, ...trines].map(anchor)
  return (
    <svg className="sf-lines" viewBox="0 0 4 4" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={[self, t1, t2].map((p) => p.join(',')).join(' ')} />
      <line x1={self[0]} y1={self[1]} x2={opp[0]} y2={opp[1]} />
    </svg>
  )
}

const ROLE_LABEL: Record<Role, string> = {
  self: '本宫',
  opposite: '对宫',
  trine: '三合',
}

function Palace({
  palace: p,
  role,
  fly,
  showSelf,
  layers,
  onActive,
}: {
  palace: ZiweiPalace
  role?: Role
  /** 四化飞星: 'src' for the hovered palace, else the 飞化 landing here */
  fly?: 'src' | ZiweiFly[] | null
  /** Mark the 自化 of this palace's own 天干 */
  showSelf: boolean
  layers: ZiweiLayer[]
  onActive: (branch: string | null) => void
}) {
  const incoming = Array.isArray(fly) ? fly : []
  const selfFlies = showSelf ? p.flies.filter((f) => f.to === p.branch) : []
  const marks = (name: string) => ({
    flown: incoming.filter((f) => f.star === name).map((f) => f.mutagen),
    self: selfFlies.filter((f) => f.star === name).map((f) => f.mutagen),
  })
  const flyClass = fly === 'src' ? ' fx-src' : incoming.length ? ' fx-to' : ''
  const flowStars = layers.flatMap((l) => l.stars[p.branch].map((s) => ({ kind: l.kind, star: s })))
  const term = useTerm()
  const t = useT()
  const [row, col] = BOARD[p.branch]
  return (
    <div
      className={`palace${p.isSoul ? ' soul' : ''}${role ? ` sf-${role}` : ''}${flyClass}`}
      style={{ gridRow: row, gridColumn: col }}
      tabIndex={0}
      aria-label={t('{palace}，{ganzhi}', { palace: term(p.name), ganzhi: p.stem + p.branch })}
      // Same pattern as the 八字 highlight: mouse hover, or focus for touch and keyboard.
      onPointerEnter={(e) => e.pointerType === 'mouse' && onActive(p.branch)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && onActive(null)}
      onFocus={() => onActive(p.branch)}
      onBlur={() => onActive(null)}
    >
      {role && <span className="sf-tag">{ROLE_LABEL[role]}</span>}
      {fly === 'src' && <span className="sf-tag fx-tag">{t('{stem}干飞出', { stem: p.stem })}</span>}
      {incoming.length > 0 && (
        <span className="sf-tag fx-tag">{t('{mutagens}入', { mutagens: incoming.map((f) => term(f.mutagen)).join('') })}</span>
      )}
      <div className="palace-stars">
        <div className="stars-major">
          {p.major.map((s) => (
            <StarItem key={s.name} star={s} layers={layers} {...marks(s.name)} />
          ))}
        </div>
        <div className="stars-minor">
          {p.minor.map((s) => (
            <StarItem key={s.name} star={s} layers={layers} {...marks(s.name)} />
          ))}
        </div>
        <div className="stars-adj">
          {p.adjective.map((s) => (
            <StarTip key={s.name} star={s} className="star-name" />
          ))}
        </div>
        {flowStars.length > 0 && (
          <div className="stars-flow">
            {flowStars.map(({ kind, star: s }) => (
              <span key={kind + s.name} className={`flow-star fl-${kind}`}>
                {term(s.name)}
              </span>
            ))}
          </div>
        )}
      </div>
      {layers.length > 0 && (
        <div className="layer-tags">
          {layers.map((l) => (
            <span key={l.kind} className={`layer-tag lm-${l.kind}${l.palaceNames[p.branch] === '命宫' ? ' soul' : ''}`}>
              {LAYER_CHAR[l.kind]}
              {term(l.palaceNames[p.branch].slice(0, 1))}
            </span>
          ))}
        </div>
      )}
      <div className="palace-foot">
        <span className="palace-decadal">
          {p.decadal[0]}–{p.decadal[1]}
        </span>
        <span className="palace-name">
          {term(p.name)}
          {p.isBody && <span className="body-tag">{term('身')}</span>}
        </span>
        <span className="palace-gz">
          {p.stem}
          {p.branch}
        </span>
      </div>
      <span className="palace-cs">{term(p.changsheng)}</span>
    </div>
  )
}

function StarItem({
  star: s,
  layers,
  flown = [],
  self = [],
}: {
  star: ZiweiStar
  layers: ZiweiLayer[]
  /** 四化 flown in from the hovered palace */
  flown?: string[]
  /** 自化 by this palace's own 天干 */
  self?: string[]
}) {
  const term = useTerm()
  return (
    <span className="star-item">
      <StarTip star={s} className={`star-name luck-${s.luck}${s.element ? ` el-${s.element}` : ''}`} />
      {s.brightness && <small className="star-bright">{term(s.brightness)}</small>}
      {s.mutagen && <span className={`mutagen m-${s.mutagen}`}>{term(s.mutagen)}</span>}
      {layers.map(
        (l) =>
          l.mutagens[s.name] && (
            <span
              key={l.kind}
              className={`mutagen lm-${l.kind}`}
              title={`${LAYER_NAME[l.kind]}化${l.mutagens[s.name]}`}
            >
              {term(l.mutagens[s.name])}
            </span>
          ),
      )}
      {flown.map((m) => (
        <span key={`f${m}`} className={`mutagen fly m-${m}`} title={`飞化${m}`}>
          {term(m)}
        </span>
      ))}
      {self.map((m) => (
        <span key={`s${m}`} className={`mutagen fly self m-${m}`} title={`自化${m}`}>
          ↑{term(m)}
        </span>
      ))}
    </span>
  )
}

/** Centre-panel summary of the selected palace's 三方四正, or a hint when none is selected. */
function SanFangSummary({ chart, active }: { chart: ReturnType<typeof buildZiwei>; active: string | null }) {
  const term = useTerm()
  const t = useT()
  // Hint and summary share one fixed-height slot: if the centre grew on hover, the
  // whole board would reflow under the pointer and the hover would flicker.
  if (!active)
    return (
      <div className="zc-sf-area">
        <p className="zc-hint muted">{t('悬停或点按宫位，这里会列出它的{sanfang}', { sanfang: term('三方四正') })}</p>
      </div>
    )
  const { opposite, trines } = sanFangSiZheng(active)
  const rows: [Role, string][] = [
    ['self', active],
    ['opposite', opposite],
    ['trine', trines[0]],
    ['trine', trines[1]],
  ]
  return (
    <div className="zc-sf-area">
      <div className="zc-sanfang" key={active}>
        <strong>{term('三方四正')}</strong>
        {rows.map(([role, b]) => {
          const p = chart.palaces[b]
          return (
            <div key={b} className={`zc-sf-row sf-${role}`}>
              <span className="zc-sf-role">{ROLE_LABEL[role]}</span>
              <b>{term(p.name)}</b>
              <span className="muted">
                {p.major.length
                  ? p.major.map((s) => term(s.name)).join(' ')
                  : t('空宫，借对宫 {stars}', {
                      stars: chart.palaces[sanFangSiZheng(b).opposite].major.map((s) => term(s.name)).join(' '),
                    })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Width and height of an element, kept current as it resizes. */
function useSize(ref: RefObject<HTMLElement | null>): [number, number] | null {
  const [size, setSize] = useState<[number, number] | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize([el.clientWidth, el.clientHeight])
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

/**
 * Arrows across the centre from the hovered palace to each palace its 天干
 * flies a 四化 into, in the 四化 colours. Drawn in pixels (not the 4×4 units
 * of the 三方四正 lines) so the arrowheads keep their shape on any board.
 * Several 四化 into one palace fan out side by side; 自化 have no arrow.
 */
function FeiHuaLines({ from, flies, size: [w, h] }: { from: string; flies: ZiweiFly[]; size: [number, number] }) {
  const px = (b: string): [number, number] => {
    const [x, y] = anchor(b)
    return [(x * w) / 4, (y * h) / 4]
  }
  const [x0, y0] = px(from)
  const out = flies.filter((f) => f.to !== from)
  return (
    <svg className="fx-lines" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {out.map((f) => {
        const same = out.filter((g) => g.to === f.to)
        const k = same.indexOf(f) - (same.length - 1) / 2
        const [x1, y1] = px(f.to)
        const len = Math.hypot(x1 - x0, y1 - y0) || 1
        const [ux, uy] = [(x1 - x0) / len, (y1 - y0) / len]
        // Side-by-side offset, and a little room at each end
        const [ox, oy] = [-uy * k * 7, ux * k * 7]
        const a = [x0 + ox + ux * 6, y0 + oy + uy * 6]
        const b = [x1 + ox - ux * 4, y1 + oy - uy * 4]
        const head = [
          b,
          [b[0] - ux * 9 - uy * 4.5, b[1] - uy * 9 + ux * 4.5],
          [b[0] - ux * 9 + uy * 4.5, b[1] - uy * 9 - ux * 4.5],
        ]
        return (
          <g key={f.mutagen} className={`fx-${f.mutagen}`}>
            <line x1={a[0]} y1={a[1]} x2={b[0] - ux * 6} y2={b[1] - uy * 6} />
            <polygon points={head.map((p) => p.join(',')).join(' ')} />
          </g>
        )
      })}
      <circle className="fx-origin" cx={x0} cy={y0} r={4} />
    </svg>
  )
}

/** Centre-panel list of the hovered palace's 宫干四化, or a hint when none is hovered. */
function FeiHuaSummary({ chart, active }: { chart: ReturnType<typeof buildZiwei>; active: string | null }) {
  const term = useTerm()
  const t = useT()
  if (!active)
    return (
      <div className="zc-sf-area">
        <p className="zc-hint muted">{t('悬停或点按宫位，这里会列出它的宫干四化飞入哪一宫')}</p>
      </div>
    )
  const p = chart.palaces[active]
  return (
    <div className="zc-sf-area">
      <div className="zc-sanfang" key={active}>
        <strong>{t('{palace} {stem}干{sihua}', { palace: term(p.name), stem: p.stem, sihua: term('四化') })}</strong>
        {p.flies.map((f) => (
          <div key={f.mutagen} className="zc-sf-row">
            <span className={`mutagen m-${f.mutagen}`}>{term(f.mutagen)}</span>
            <b>{term(f.star)}</b>
            <span className="muted">
              {f.to === active ? '自化' : t('入{palace}', { palace: term(chart.palaces[f.to].name) })}
              {f.mutagen === '忌' && ` · ${t('冲{palace}', { palace: term(chart.palaces[sanFangSiZheng(f.to).opposite].name) })}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
