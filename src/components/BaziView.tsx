import { Suspense, lazy, useMemo, useRef, useState } from 'react'
import { FortuneRow } from './FortuneRow'
import { TitleMark } from './Logo'
import { SectionNav } from './SectionNav'
import { useScrollHints } from './useScrollHints'
import {
  ELEMENTS,
  buildBazi,
  currentFlowMonth,
  flowDays,
  flowMonths,
  fortunePillars,
  fortuneRelations,
  type BaziInput,
  type FortuneColumn,
} from '../lib/bazi'
import type { Relation } from '../lib/relations'
import type { SchoolSettings } from '../lib/schools'
import { Char } from './Char'
import { BirthForm, dateText, dateTimeText, monthDayText } from './BirthForm'
import { SchoolMark, SchoolSettingsPanel } from './Schools'
import { HighlightScope, useHighlight, useTrigger } from './highlight'
import { ConceptTip } from './GlossaryTips'
import { PillarTable } from './PillarTable'
import { DEFAULT_PLACE } from '../lib/place'
import { toUtc } from '../lib/timeZone'
import { useSettings, useT, useTerm } from '../settingsContext'

// 生辰星空 and the 五星: they bring the star catalogue and astronomy-engine, so they load apart
const loadBirthSky = () => import('./BirthSky')
const BirthSky = lazy(() => loadBirthSky().then((m) => ({ default: m.BirthSky })))
const FiveStars = lazy(() => loadBirthSky().then((m) => ({ default: m.FiveStars })))

interface Props {
  input: BaziInput
  onChange: (input: BaziInput) => void
  schools: SchoolSettings
  onSchoolsChange: (schools: SchoolSettings) => void
}

export function BaziView({ input, onChange, schools, onSchoolsChange }: Props) {
  const chart = useMemo(() => buildBazi(input, schools), [input, schools])
  const term = useTerm()
  const t = useT()
  const { language, birthSky } = useSettings()
  // The moment of birth on the clock at the birthplace (the sky as it was; 真太阳时 is for the 八字)
  const moment = useMemo(() => {
    const place = input.place ?? DEFAULT_PLACE
    const { year, month, day, hour, minute } = input
    return { utc: toUtc({ year, month, day, hour, minute }, place.timeZone).date, latitude: place.latitude, longitude: place.longitude }
  }, [input])
  // A 五星 (or 日, 月) pointed at in its row, picked out in the sky behind
  const [skyFocus, setSkyFocus] = useState<string | null>(null)
  const unpicked = t('未选 · 不入盘')
  const ageText = (age: number) => t('{age}岁', { age })
  const thisYear = new Date().getFullYear()
  const currentDecade = Math.max(
    0,
    chart.decades.findIndex((d) => d.startYear <= thisYear && thisYear <= d.endYear),
  )
  const [picked, setPicked] = useState<number | null>(null)
  const decadeIndex = picked ?? currentDecade
  const decade = chart.decades[decadeIndex]
  const [pickedYear, setPickedYear] = useState<number | null>(null)
  const [pickedMonth, setPickedMonth] = useState<number | null>(null)
  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const fortuneYear =
    decade.years.find((y) => y.year === pickedYear) ?? decade.years.find((y) => y.year === thisYear) ?? decade.years[0]
  const dayMaster = chart.dayMaster.char
  const months = useMemo(() => flowMonths(fortuneYear.year, dayMaster), [fortuneYear.year, dayMaster])
  const todayMonth = useMemo(() => currentFlowMonth(fortuneYear.year), [fortuneYear.year])
  const month = months[pickedMonth ?? todayMonth ?? 0]
  const days = useMemo(
    () => flowDays(fortuneYear.year, month.index, dayMaster),
    [fortuneYear.year, month.index, dayMaster],
  )
  const day = days.find((d) => d.key === pickedDay) ?? days.find((d) => d.isToday) ?? days[0]

  // Clicking the picked chip again leaves that level out of the 岁运盘; picking
  // any chip of the level brings it back. The 大运 is always in.
  const [off, setOff] = useState<Record<FortuneLevel, boolean>>({ year: false, month: false, day: false })
  const choose = (level: FortuneLevel, again: boolean, pick: () => void) => {
    if (again && !off[level]) return setOff((o) => ({ ...o, [level]: true }))
    setOff((o) => ({ ...o, [level]: false }))
    pick()
  }
  // Picking a coarser level resets the finer ones to their defaults.
  const pickDecade = (i: number) => {
    setPicked(i)
    setPickedYear(null)
    setPickedMonth(null)
    setPickedDay(null)
  }
  // 流月 and 流日 hang off the 流年: leaving it out shuts and drops them too, and
  // bringing it back opens the 流月 list to pick from.
  const pickYear = (y: number) => {
    if (y === fortuneYear.year && !off.year) {
      setOff((o) => ({ ...o, year: true, month: true, day: true }))
      setOpen((o) => ({ ...o, month: false, day: false }))
      return
    }
    if (off.year) setOpen((o) => ({ ...o, month: true }))
    choose('year', false, () => {
      setPickedYear(y)
      setPickedMonth(null)
      setPickedDay(null)
    })
  }
  // 流日 hangs off the 流月 the same way.
  const pickMonth = (i: number) => {
    if (i === month.index && !off.month) {
      setOff((o) => ({ ...o, month: true, day: true }))
      setOpen((o) => ({ ...o, day: false }))
      return
    }
    if (off.month) setOpen((o) => ({ ...o, day: true }))
    choose('month', false, () => {
      setPickedMonth(i)
      setPickedDay(null)
    })
  }
  const pickDay = (key: string) => choose('day', key === day.key, () => setPickedDay(key))
  const chipClass = (level: FortuneLevel, selected: boolean, current: boolean) =>
    ['fortune', current && 'current', selected && !off[level] && 'selected'].filter(Boolean).join(' ')

  // 流日 → 大运, the usual 岁运盘 order (finest first), then the natal chart.
  const levels: [FortuneLevel | 'decade', FortuneColumn, string][] = [
    ['day', { label: '流日', ganzhi: day.ganzhi }, monthDayText(language, day.month, day.day)],
    ['month', { label: '流月', ganzhi: month.ganzhi }, `${month.ganzhi}月`],
    [
      'year',
      { label: '流年', ganzhi: fortuneYear.ganzhi },
      t('{year}{ganzhi}年', { year: fortuneYear.year, ganzhi: fortuneYear.ganzhi }),
    ],
    ['decade', { label: '大运', ganzhi: decade.ganzhi }, `${decade.ganzhi}${term('运')}`],
  ]
  const shown = levels.filter(([level]) => level === 'decade' || !off[level])
  const columns = shown.map(([, column]) => column)
  const combined = fortunePillars(chart, columns, schools)
  const fortuneRels = fortuneRelations(chart, columns, schools)

  // 岁运盘: phones show only the four 岁运 columns unless 合参原局 is switched on.
  const [withNatal, setWithNatal] = useState(() => window.matchMedia('(min-width: 640px)').matches)
  // With no 岁运 picked, the 岁运盘 falls back to the natal chart alone.
  const natalShown = withNatal || columns.length === 0
  const tableRef = useRef<HTMLDivElement>(null)
  useScrollHints(tableRef, `${decadeIndex}|${fortuneYear.year}|${month.index}|${day.key}|${withNatal}|${columns.length}`)

  const [open, setOpen] = useState({ decade: true, year: true, month: true, day: true })
  // The 岁运 picker is a panel laid over the 岁运盘; closed, it leaves a slim tab.
  const [sideOpen, setSideOpen] = useState(() => {
    try {
      return localStorage.getItem(SIDE_KEY) !== 'closed'
    } catch {
      return true
    }
  })
  const toggleSide = () =>
    setSideOpen((v) => {
      try {
        localStorage.setItem(SIDE_KEY, v ? 'closed' : 'open')
      } catch {
        // storage unavailable: lasts for this visit
      }
      return !v
    })
  const toggle = (key: keyof typeof open) => setOpen((o) => ({ ...o, [key]: !o[key] }))
  const toggleAll = () => {
    const next = !Object.values(open).every(Boolean)
    setOpen({ decade: next, year: next, month: next, day: next })
  }
  const total = ELEMENTS.reduce((s, e) => s + chart.elementCount[e], 0)

  const update = (patch: Partial<BaziInput>) => {
    setPicked(null)
    setPickedYear(null)
    setPickedMonth(null)
    setPickedDay(null)
    onChange({ ...input, ...patch })
  }

  return (
    <div className="bazi-layout">
      {birthSky === 'show' && (
        <Suspense fallback={null}>
          <BirthSky moment={moment} focus={skyFocus} />
        </Suspense>
      )}
      <BirthForm
        input={input}
        onChange={update}
        schoolsPanel={<SchoolSettingsPanel settings={schools} onChange={onSchoolsChange} />}
      />

      <SectionNav
        items={[
          ['bazi-natal', term('原局')],
          ['bazi-fortune', term('岁运')],
        ]}
      />

      <section className="card" id="bazi-natal">
        <div className="chart-meta">
          <div>
            <strong>{chart.gender === '男' ? term('乾造') : term('坤造')}</strong> ·{' '}
            {t('属{zodiac}', { zodiac: term(chart.zodiac) })}
          </div>
          <div className="muted">{t('阳历 {date}', { date: dateTimeText(language, input) })}</div>
          {chart.trueSolar && (
            <div className="muted">
              {t('真太阳时 {time}（{offset}分）', {
                time: dateTimeText(language, chart.trueSolar.time),
                offset: `${chart.trueSolar.offsetMinutes >= 0 ? '+' : '−'}${Math.abs(Math.round(chart.trueSolar.offsetMinutes))}`,
              })}
            </div>
          )}
          <div className="muted">
            {term('农历')} {term(chart.lunarText)}
          </div>
        </div>

        <HighlightScope pillars={chart.pillars} relations={chart.relations}>
          <PillarTable
            pillars={chart.pillars}
            schools={schools}
            dayMaster={chart.dayMaster.char}
            headerExtra={(p) =>
              chart.lateZiHour &&
              (p.label === '日柱' || p.label === '时柱') && <SchoolMark school="ziHour" settings={schools} />
            }
          />

          <div className="elements">
            {ELEMENTS.map((e) => (
              <div key={e} className="el-bar">
                <span className={`el-${e}`}>{e}</span>
                <div className="track">
                  <div className={`fill bg-${e}`} style={{ width: `${(chart.elementCount[e] / total) * 100}%` }} />
                </div>
                <span className="muted">{chart.elementCount[e]}</span>
              </div>
            ))}
          </div>
          <Suspense fallback={null}>
            <FiveStars moment={moment} focus={skyFocus} onFocus={setSkyFocus} />
          </Suspense>

          <Relations title={term('原局刑冲合会')} items={chart.relations} schools={schools} />
        </HighlightScope>

        <dl className="kv inline">
          <dt>
            <ConceptTip name="胎元" />
          </dt>
          <dd>{chart.fetalOrigin}</dd>
          <dt>
            <ConceptTip name="胎息" />
          </dt>
          <dd>{chart.fetalBreath}</dd>
          <dt>
            <ConceptTip name="命宫" />
          </dt>
          <dd>{chart.ownSign}</dd>
          <dt>
            <ConceptTip name="身宫" />
          </dt>
          <dd>{chart.bodySign}</dd>
        </dl>
      </section>

      <section className={`card fortunes fortune-combo${sideOpen ? ' side-open' : ''}`} id="bazi-fortune">
        <button
          type="button"
          className="side-handle"
          aria-expanded={sideOpen}
          aria-controls="fortune-side"
          onClick={toggleSide}
          title={sideOpen ? t('收起岁运') : t('展开岁运')}
        >
          <span className="side-handle-title">{term('岁运')}</span>
          <span className="side-handle-sub">
            {decade.ganzhi}
            {term('运')} · {fortuneYear.year}
          </span>
          <span aria-hidden="true">›</span>
        </button>
        <aside id="fortune-side" className="fortune-side" aria-label={term('岁运')} hidden={!sideOpen}>
          <div className="fortunes-head">
            <h3>
              <TitleMark />
              {term('岁运')}
            </h3>
            <button type="button" className="ghost" onClick={toggleAll}>
              {Object.values(open).every(Boolean) ? t('全部收起') : t('全部展开')}
            </button>
            <button type="button" className="ghost side-close" aria-expanded onClick={toggleSide} title={t('收起岁运')}>
              ‹ {t('收起')}
            </button>
          </div>
          <FortuneRow
            title={term('大运')}
            summary={`${decade.ganzhi} · ${t('{from}–{to}岁', { from: decade.startAge, to: decade.endAge })} · ${decade.startYear}–${decade.endYear}`}
            open={open.decade}
            onToggle={() => toggle('decade')}
          >
            <p className="muted row-note">
              {t('出生后{years}年{months}个月{days}天起运（{date}交运），{direction}', {
                years: chart.start.years,
                months: chart.start.months,
                days: chart.start.days,
                date: dateText(language, chart.start),
                direction: chart.start.forward ? t('顺排') : t('逆排'),
              })}
              <SchoolMark school="childLimit" settings={schools} />
            </p>
            <div className="fortune-row" data-sounds="gong">
              {chart.decades.map((d, i) => (
                <button
                  key={d.startYear}
                  className={['fortune', i === decadeIndex && 'selected', i === currentDecade && 'current']
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => pickDecade(i)}
                >
                  <small>{ageText(d.startAge)}</small>
                  <small className="muted">{d.startYear}</small>
                  <Char g={d.stem} small />
                  <Char g={d.branch} small />
                  <small>{term(d.stem.tenStar ?? '')}</small>
                </button>
              ))}
            </div>
          </FortuneRow>
          <FortuneRow
            title={term('流年')}
            summary={off.year ? unpicked : `${fortuneYear.year} ${fortuneYear.ganzhi} · ${ageText(fortuneYear.age)}`}
            open={open.year}
            onToggle={() => toggle('year')}
          >
            <div className="fortune-row" data-sounds="shang">
              {decade.years.map((y) => (
                <button
                  key={y.year}
                  className={chipClass('year', y.year === fortuneYear.year, y.year === thisYear)}
                  aria-pressed={y.year === fortuneYear.year && !off.year}
                  onClick={() => pickYear(y.year)}
                >
                  <small>{y.year}</small>
                  <small className="muted">{ageText(y.age)}</small>
                  <Char g={y.stem} small />
                  <Char g={y.branch} small />
                  <small>{term(y.stem.tenStar ?? '')}</small>
                </button>
              ))}
            </div>
          </FortuneRow>
          <FortuneRow
            title={term('流月')}
            summary={off.month ? unpicked : `${month.ganzhi} · ${t('{date}起', { date: month.start })}`}
            open={open.month}
            onToggle={() => toggle('month')}
          >
            <div className="fortune-row months" data-sounds="jue">
              {months.map((m) => (
                <button
                  key={m.index}
                  className={chipClass('month', m.index === month.index, m.index === todayMonth)}
                  aria-pressed={m.index === month.index && !off.month}
                  onClick={() => pickMonth(m.index)}
                >
                  <small>{m.start}</small>
                  <Char g={m.stem} small />
                  <Char g={m.branch} small />
                  <small>{term(m.stem.tenStar ?? '')}</small>
                </button>
              ))}
            </div>
          </FortuneRow>
          <FortuneRow
            title={term('流日')}
            summary={off.day ? unpicked : `${day.month}/${day.day} ${day.ganzhi}`}
            open={open.day}
            onToggle={() => toggle('day')}
          >
            <div className="fortune-row days" data-sounds="zhi">
              {days.map((d) => (
                <button
                  key={d.key}
                  className={chipClass('day', d.key === day.key, d.isToday)}
                  aria-pressed={d.key === day.key && !off.day}
                  onClick={() => pickDay(d.key)}
                >
                  <small>
                    {d.month}/{d.day}
                  </small>
                  <Char g={d.stem} small />
                  <Char g={d.branch} small />
                  <small>{term(d.stem.tenStar ?? '')}</small>
                </button>
              ))}
            </div>
          </FortuneRow>
        </aside>

        <div className="fortune-main" id="bazi-combined">
          <div className="fortunes-head">
            <h3 className="section-title">
              <TitleMark />
              {term('岁运盘')}
            </h3>
            <button
              type="button"
              className={`ghost toggle${withNatal ? ' on' : ''}`}
              aria-pressed={withNatal}
              onClick={() => setWithNatal((v) => !v)}
            >
              {t('合参{natal}', { natal: term('原局') })}
            </button>
          </div>
          <p className="muted row-note">
            {shown.length > 0
              ? t('{picks}，合参命主原局', { picks: shown.map(([, , note]) => note).join(' · ') })
              : t('未选中{fortune}，在{fortune}中点选大运、流年、流月或流日', { fortune: term('岁运') })}
          </p>
          <HighlightScope pillars={[...combined, ...chart.pillars]} relations={fortuneRels}>
            <div className={`table-scroll${natalShown ? '' : ' fortune-only'}`} ref={tableRef}>
              <PillarTable
                pillars={natalShown ? [...combined, ...chart.pillars] : combined}
                schools={schools}
                dividerAt={natalShown && combined.length > 0 ? combined.length : undefined}
                dayMaster={chart.dayMaster.char}
                animate
              />
            </div>
            <Relations
              title={term('岁运刑冲合会')}
              items={fortuneRels}
              schools={schools}
              empty={t('与原局无明显刑冲合会')}
            />
          </HighlightScope>
        </div>
      </section>
    </div>
  )
}

function Relations({
  title,
  items,
  schools,
  empty,
}: {
  title: string
  items: Relation[]
  schools: SchoolSettings
  empty?: string
}) {
  const t = useT()
  return (
    <div className="relations">
      <h4>
        <TitleMark />
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="muted">{empty ?? t('无')}</p>
      ) : (
        <div className="tags">
          {items.map((r, i) => (
            <RelationChip key={r.text + r.members.join('')} relation={r} index={i} schools={schools} />
          ))}
        </div>
      )}
    </div>
  )
}

function RelationChip({ relation: r, index, schools }: { relation: Relation; index: number; schools: SchoolSettings }) {
  const term = useTerm()
  const { hover, rels } = useHighlight()
  const trigger = useTrigger({ kind: 'rel', index })
  const state = rels.has(index) ? ' hl-on' : hover ? ' hl-dim' : ''
  return (
    <span className={`rel rel-${r.kind} hl-target${state}`} {...trigger}>
      <b>{term(r.members.join('·'))}</b> {term(r.text)}
      {r.school && <SchoolMark school={r.school} settings={schools} />}
    </span>
  )
}

const SIDE_KEY = 'chroniq-fortune-side'

/** The 岁运 levels that can be left out of the 岁运盘 (the 大运 cannot). */
type FortuneLevel = 'year' | 'month' | 'day'
