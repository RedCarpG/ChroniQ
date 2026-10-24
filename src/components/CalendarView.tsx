import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SolarDay } from 'tyme4ts'
import { Char } from './Char'
import { MonthPicker } from './MonthPicker'
import { WeekView, YearView, dayTone } from './CalendarViews'
import { MonthOutline } from './MonthOutline'
import {
  WEEKDAYS_EN,
  buildDayDetail,
  buildMonthGrid,
  buildMonthStrip,
  buildWeek,
  buildYear,
  enDate,
  enMonth,
  sameDay,
  todaySolar,
  weekTitles,
} from '../lib/calendar'
import {
  REGIONS,
  chosenDays,
  loadHolidayChoice,
  offTags,
  saveHolidayChoice,
  type HolidayChoice,
  type RegionCode,
  type RegionDay,
} from '../lib/regionHolidays'
import type { DayCell } from '../lib/calendar'
import { onGrid, type ChartDay } from '../lib/chartDays'
import { useChartDayText, useChartDays } from './useChartDays'
import { useSettings, useT, useTerm } from '../settingsContext'

// tyme4ts handles far wider ranges; this keeps the dropdown a manageable length.
const MIN_YEAR = 1900
const MAX_YEAR = 2100
const YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

type ViewMode = 'month' | 'week' | 'year'
const VIEW_MODES: ViewMode[] = ['month', 'week', 'year']

interface Props {
  onPickBazi: (day: SolarDay) => void
}

export function CalendarView({ onPickBazi }: Props) {
  const [selected, setSelected] = useState(todaySolar)
  const [view, setView] = useState(() => ({ year: selected.getYear(), month: selected.getMonth() }))

  const { weekStart, dayGanzhi, language } = useSettings()
  const term = useTerm()
  const t = useT()
  const en = language === 'en'
  // 节假日: China's festivals and 休 / 班 (on by default) and other countries', chosen at the
  // bottom of the right panel and kept in this browser
  const [holidays, setHolidays] = useState<HolidayChoice>(loadHolidayChoice)
  const updateHolidays = (next: HolidayChoice) => {
    setHolidays(next)
    saveHolidayChoice(next)
  }
  const toggleRegion = (code: RegionCode) =>
    updateHolidays({
      ...holidays,
      regions: holidays.regions.includes(code) ? holidays.regions.filter((c) => c !== code) : [...holidays.regions, code],
    })
  const regionOf = (s: SolarDay) => chosenDays(holidays.regions, s.getYear(), s.getMonth(), s.getDay())
  const dayName = (d: RegionDay) => (en ? d.en : d.name)
  const regionPicked = regionOf(selected)
  /** With China's holidays hidden, a day shows its 节气 or lunar date instead, and no 休 / 班 */
  const withChina = <T extends DayCell>(c: T): T =>
    holidays.china ? c : { ...c, festival: undefined, holiday: undefined, sub: c.plainSub, subKind: c.plainKind }
  // 命盘: the saved charts' dates (birthdays, 冲 / 合, 交运, 星盘), chosen in the day panel
  const chartDays = useChartDays()
  const chartText = useChartDayText()
  /** A chart's dates worth a line in the grid, on a day */
  const gridDays = (solar: SolarDay, ganzhi: string) => chartDays.daysOf(solar, ganzhi).filter(onGrid)
  const chartLine = (days: ChartDay[]) => (days.length > 1 ? `${chartText(days[0])} +${days.length - 1}` : chartText(days[0]))
  const modeLabel: Record<ViewMode, string> = { month: t('月'), week: t('周'), year: t('年') }
  // aria-labels for « ‹ › » in each mode
  const navLabels: Record<ViewMode, [string, string, string, string]> = {
    month: [t('上一年'), t('上个月'), t('下个月'), t('下一年')],
    week: [t('前四周'), t('上一周'), t('下一周'), t('后四周')],
    year: ['', t('上一年'), t('下一年'), ''],
  }
  const [mode, setMode] = useState<ViewMode>('month')
  const cells = useMemo(
    () => (mode === 'month' ? buildMonthGrid(view.year, view.month, weekStart) : []),
    [mode, view, weekStart],
  ).map(withChina)
  const weekDays = useMemo(() => (mode === 'week' ? buildWeek(selected, weekStart) : []), [mode, selected, weekStart]).map(withChina)
  const yearMonths = useMemo(() => (mode === 'year' ? buildYear(view.year, weekStart) : []), [mode, view.year, weekStart]).map(
    (m) => ({ ...m, days: m.days.map(withChina) }),
  )
  // Moving between months, weeks or years. To the month just before or after, the grid
  // becomes one run of weeks covering both and scrolls up or down to the new one, so the
  // weeks they share stay put (scroll, animated below). Any other move slides the new view
  // in from below (later) or above (earlier) and changing view fades (styles.css .cal-slide);
  // the key remounts the view so that animation plays. Worked out while rendering, from what
  // was shown last.
  const first = weekDays[0]?.solar
  const order =
    mode === 'week' && first
      ? first.getYear() * 10000 + first.getMonth() * 100 + first.getDay()
      : mode === 'year'
        ? view.year
        : view.year * 12 + view.month
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const last = useRef({ mode, order })
  const slide = useRef('')
  const viewKey = useRef(`${mode}-${order}`)
  const scroll = useRef<(ReturnType<typeof buildMonthStrip> & { id: number }) | null>(null)
  const [, scrolled] = useState(0)
  if (last.current.mode !== mode) {
    slide.current = 'fade'
    scroll.current = null
    viewKey.current = `${mode}-${order}`
  } else if (last.current.order !== order) {
    if (mode === 'month' && Math.abs(order - last.current.order) === 1 && !reduceMotion) {
      const from = { year: Math.floor((last.current.order - 1) / 12), month: ((last.current.order - 1) % 12) + 1 }
      scroll.current = { ...buildMonthStrip(from, view, weekStart), id: order }
      slide.current = ''
    } else {
      scroll.current = null
      slide.current = order > last.current.order ? 'next' : 'back'
      viewKey.current = `${mode}-${order}`
    }
  }
  last.current = { mode, order }
  const monthCells = scroll.current ? scroll.current.cells.map(withChina) : cells

  // The scroll: hold the window at six rows, run the strip from the old month's rows to the
  // new month's, then show the plain grid again. The strip keeps its last frame (fill) until
  // the plain grid has rendered, and only then is the animation dropped, in the same layout
  // pass, before anything is painted: the plain grid lines up with that frame, so nothing
  // moves or flashes at the swap.
  const windowRef = useRef<HTMLDivElement>(null)
  const gridHeight = useRef(0)
  // The plain grid's row height: the strip keeps it, also where the grid is stretched to fill the window
  const rowHeight = useRef(0)
  const running = useRef<{ id: number; anim: Animation } | null>(null)
  useLayoutEffect(() => {
    const win = windowRef.current
    const grid = win?.querySelector<HTMLElement>('.grid.days')
    const s = scroll.current
    if (!win || !grid) return
    if (!s) {
      if (running.current) {
        running.current.anim.cancel()
        running.current = null
        win.style.height = ''
        win.classList.remove('scrolling')
      }
      gridHeight.current = grid.getBoundingClientRect().height / zoomOf(grid)
      const firstDay = grid.querySelector<HTMLElement>('.day')
      if (firstDay) rowHeight.current = firstDay.getBoundingClientRect().height / zoomOf(grid)
      return
    }
    if (running.current?.id === s.id) return
    running.current?.anim.cancel()
    // Exact (fractional) offsets of the two months' first rows, so the last frame lines up
    // with the plain grid to the sub-pixel; measured sizes include the page zoom (显示大小)
    const days = grid.querySelectorAll<HTMLElement>('.day')
    const zoom = zoomOf(grid)
    const top = (rowIndex: number) => (days[rowIndex * 7].getBoundingClientRect().top - days[0].getBoundingClientRect().top) / zoom
    win.style.height = `${gridHeight.current || top(6)}px`
    win.classList.add('scrolling')
    const anim = grid.animate(
      [{ transform: `translateY(${-top(s.fromRow)}px)` }, { transform: `translateY(${-top(s.toRow)}px)` }],
      { duration: 420, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'forwards' },
    )
    running.current = { id: s.id, anim }
    const finish = () => {
      if (scroll.current !== s) return
      scroll.current = null
      scrolled((n) => n + 1)
    }
    anim.onfinish = finish
    // Also if the page is not being drawn and the animation never runs
    setTimeout(finish, 700)
  })
  const monthDay = (d: SolarDay) =>
    en ? enDate(d.getYear(), d.getMonth(), d.getDay(), { day: 'numeric', month: 'short' }) : `${d.getMonth()}月${d.getDay()}日`
  const weekRange = weekDays.length > 0 ? `${monthDay(weekDays[0].solar)} – ${monthDay(weekDays[6].solar)}` : ''
  const detail = useMemo(() => buildDayDetail(selected), [selected])
  // The selected day's chart dates (all of them, not only those on the grid) and 太岁 by its 干支 year
  const pickedChartDays = chartDays.daysOf(selected, detail.pillars[2].stem.char + detail.pillars[2].branch.char)
  const pickedTaiSui = chartDays.taiSuiOf(detail.pillars[0].branch.char)

  const shiftMonth = (delta: number) =>
    setView(({ year, month }) => {
      const m = year * 12 + (month - 1) + delta
      const next = { year: Math.floor(m / 12), month: (m % 12) + 1 }
      return next.year < MIN_YEAR || next.year > MAX_YEAR ? { year, month } : next
    })

  const select = (day: SolarDay) => {
    if (day.getYear() < MIN_YEAR || day.getYear() > MAX_YEAR) return
    setSelected(day)
    setView({ year: day.getYear(), month: day.getMonth() })
  }

  /** ‹ › step by ±1 (month / week / year); « » by ±2 (year / four weeks). */
  const shift = (step: -2 | -1 | 1 | 2) => {
    if (mode === 'week') select(selected.next(Math.sign(step) * (Math.abs(step) === 2 ? 28 : 7)))
    else if (mode === 'year') shiftMonth(step * 12)
    else shiftMonth(Math.abs(step) === 2 ? Math.sign(step) * 12 : step)
  }

  const lunarYear = SolarDay.fromYmd(view.year, view.month, 15).getLunarDay().getYearSixtyCycle()

  return (
    <div className="calendar-layout">
      <section className="card calendar">
        <header className="cal-head">
          <div className="cal-title">
            <h2 className="cal-pickers">
              {mode === 'week' ? (
                <span className="week-range">{weekRange}</span>
              ) : (
                <select
                  aria-label={t('年份')}
                  value={view.year}
                  onChange={(e) => setView((v) => ({ ...v, year: Number(e.target.value) }))}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {t('{y}年', { y })}
                    </option>
                  ))}
                </select>
              )}
              {mode === 'month' && (
                <select
                  aria-label={t('月份')}
                  value={view.month}
                  onChange={(e) => setView((v) => ({ ...v, month: Number(e.target.value) }))}
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {en ? enMonth(m) : `${m}月`}
                    </option>
                  ))}
                </select>
              )}
              <MonthPicker
                year={view.year}
                month={view.month}
                minYear={MIN_YEAR}
                maxYear={MAX_YEAR}
                onPickMonth={(year, month) =>
                  mode === 'week' ? select(SolarDay.fromYmd(year, month, 1)) : setView({ year, month })
                }
                onPickDay={select}
              />
            </h2>
            <span className="muted">
              {t('{ganzhi}年 · {zodiac}年', {
                ganzhi: lunarYear.getName(),
                zodiac: term(lunarYear.getEarthBranch().getZodiac().getName()),
              })}
            </span>

          </div>
          <div className="cal-tools">
            <div className="seg small" role="group" aria-label={t('视图')}>
              {VIEW_MODES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={mode === value ? 'on' : undefined}
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                >
                  {modeLabel[value]}
                </button>
              ))}
            </div>
            <div className="cal-nav">
              {mode !== 'year' && (
                <button onClick={() => shift(-2)} aria-label={navLabels[mode][0]}>
                  «
                </button>
              )}
              <button onClick={() => shift(-1)} aria-label={navLabels[mode][1]}>
                ‹
              </button>
              <button onClick={() => select(todaySolar())}>{t('今天')}</button>
              <button onClick={() => shift(1)} aria-label={navLabels[mode][2]}>
                ›
              </button>
              {mode !== 'year' && (
                <button onClick={() => shift(2)} aria-label={navLabels[mode][3]}>
                  »
                </button>
              )}
            </div>
          </div>
        </header>

        {mode === 'month' && (
          <>
            <div className="grid week-titles">
              {weekTitles(weekStart).map((w) => (
                <div key={w.index} className={w.weekend ? 'weekend' : undefined}>
                  {en ? WEEKDAYS_EN[w.index] : w.name}
                </div>
              ))}
            </div>
            <div key={viewKey.current} className={`cal-slide ${slide.current}`}>
              <div className="month-window" ref={windowRef}>
              <div
                className="grid days"
                style={
                  scroll.current && rowHeight.current
                    ? { gridTemplateRows: `repeat(${scroll.current.cells.length / 7}, ${rowHeight.current}px)`, height: 'auto' }
                    : undefined
                }
              >
                <MonthOutline layoutKey={`${view.year}-${view.month}-${weekStart}-${scroll.current ? 'strip' : 'grid'}`} />
                {monthCells.map((c) => {
                  const rd = regionOf(c.solar)
                  // A Chinese festival keeps the line; else the country's day, unless it is only notable and a 节气 starts
                  const regionSub = c.subKind !== 'festival' && rd[0] && (rd[0].kind !== 'observance' || c.subKind !== 'term') ? rd[0] : undefined
                  const mine = gridDays(c.solar, c.ganzhi)
                  return (
                  <button
                    key={c.key}
                    className={[
                      'day',
                      !c.inMonth && 'out',
                      dayTone(c, rd, mine),
                      c.isToday && 'today',
                      c.isWeekend && 'weekend',
                      sameDay(c.solar, selected) && 'selected',
                      mine.length > 0 && 'mine',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title={mine.map(chartText).join('\n') || undefined}
                    onClick={() => select(c.solar)}
                  >
                    {c.holiday && <span className={`badge ${c.holiday === '休' ? 'off' : 'work'}`}>{t(c.holiday)}</span>}
                    {offTags(rd).length > 0 && (
                      <span className={`badge region${offTags(rd).every((x) => x.partial) ? ' partial' : ''}`}>
                        {offTags(rd).map((x) => x.tag).join(' ')}
                      </span>
                    )}
                    <span className="num">{c.day}</span>
                    {regionSub ? (
                      <span className={`sub region ${regionSub.kind}`}>{dayName(regionSub)}</span>
                    ) : (
                      <span className={`sub ${c.subKind}`}>{term(c.sub)}</span>
                    )}
                    {dayGanzhi === 'show' && <span className="gz">{c.ganzhi}</span>}
                    {mine.length > 0 && <span className="mine-line">{chartLine(mine)}</span>}
                  </button>
                  )
                })}
              </div>
              </div>
            </div>
          </>
        )}

        {mode === 'week' && (
          <div key={viewKey.current} className={`cal-slide ${slide.current}`}>
            <WeekView
              days={weekDays}
              selected={selected}
              onSelect={select}
              showGanzhi={dayGanzhi === 'show'}
              regionOf={regionOf}
              chartDaysOf={gridDays}
              chartText={chartText}
            />
          </div>
        )}

        {mode !== 'year' && (
          <ul className="cal-legend" aria-label={t('图例')}>
            {holidays.china && (
              <>
                <li>
                  <i className="tone-off" />
                  {t('休 · 放假')}
                </li>
                <li>
                  <i className="tone-work" />
                  {t('班 · 调休上班')}
                </li>
                <li>
                  <i className="tone-festival" />
                  {t('节日')}
                </li>
              </>
            )}
            {holidays.regions.map((code) => (
              <li key={code}>
                <i className="tone-region" />
                {t('{country}假日', { country: t(REGIONS[code].name) })}
              </li>
            ))}
            {chartDays.shown.length > 0 && chartDays.items.length > 0 && (
              <li>
                <i className="tone-mine" />
                {t('命盘')}
              </li>
            )}
            <li>
              <i className="tone-weekend" />
              {t('周末')}
            </li>
            <li>
              <i className="tone-today" />
              {t('今天')}
            </li>
          </ul>
        )}

        {mode === 'year' && chartDays.taiSuiOf(yearBranch(view.year)).length > 0 && (
          <p className="muted row-note year-taisui">
            {chartDays
              .taiSuiOf(yearBranch(view.year))
              .map((x) => (x.which === '本命年' ? t('{name}本命年', { name: x.name }) : t('{name}冲太岁', { name: x.name })))
              .join(' · ')}
          </p>
        )}
        {mode === 'year' && (
          <div key={viewKey.current} className={`cal-slide ${slide.current}`}>
            <YearView
              months={yearMonths}
              weekStart={weekStart}
              selected={selected}
              onSelect={select}
              regionOf={regionOf}
              chartDaysOf={gridDays}
              chartText={chartText}
              onOpenMonth={(month) => {
                setView((v) => ({ ...v, month }))
                setMode('month')
              }}
            />
          </div>
        )}
      </section>

      <aside className="card detail">
        <div className="detail-hero">
          <div className="big">{selected.getDay()}</div>
          <div>
            <div>
              {en
                ? enDate(selected.getYear(), selected.getMonth(), selected.getDay(), { day: 'numeric', month: 'long', year: 'numeric' })
                : detail.solarText}
            </div>
            <div className="muted">
              {en
                ? enDate(selected.getYear(), selected.getMonth(), selected.getDay(), { weekday: 'long' })
                : detail.weekText}{' '}
              · {t(detail.constellation)}
            </div>
          </div>
        </div>
        <div className="lunar-line">
          {term('农历')}
          {term(detail.lunarText)}
          <span className="muted"> · {t('属{zodiac}', { zodiac: term(detail.zodiac) })}</span>
        </div>
        <div className="day-pillars" aria-label={detail.ganzhi}>
          {detail.pillars.map((p) => (
            <div key={p.label} className="day-pillar">
              <span className="muted">{t(p.label)}</span>
              <Char g={p.stem} />
              <Char g={p.branch} />
            </div>
          ))}
        </div>
        {holidays.china && detail.festivals.length > 0 && (
          <div className="tags">
            {detail.festivals.map((f) => (
              <span key={f} className="tag festival">
                {term(f)}
              </span>
            ))}
          </div>
        )}
        {regionPicked.length > 0 && (
          <div className="region-days">
            <ul>
              {regionPicked.map((d) => (
                <li key={d.code + d.local}>
                  <span className="tag-title neutral">{t(REGIONS[d.code].name)}</span>
                  <span className={`tag region ${d.kind}`}>{dayName(d)}</span>
                  <span className="muted">
                    {d.local}
                    {' · '}
                    {d.kind === 'public' ? t('公众假日') : d.kind === 'regional' ? t('地区假日') : t('纪念日')}
                    {d.note && ` · ${en ? d.noteEn : d.note}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(pickedChartDays.length > 0 || pickedTaiSui.length > 0) && (
          <div className="mine-days">
            <span className="tag-title neutral">{t('命盘')}</span>
            <ul>
              {pickedChartDays.map((d, i) => (
                <li key={i} className={`mine-${d.kind}`}>
                  {chartText(d)}
                </li>
              ))}
              {pickedTaiSui.map((x) => (
                <li key={x.name + x.which} className="mine-taisui">
                  {x.which === '本命年' ? t('{name}本命年', { name: x.name }) : t('{name}冲太岁', { name: x.name })}
                </li>
              ))}
            </ul>
          </div>
        )}
        <dl className="kv">
          <dt>{term('节气')}</dt>
          <dd>{t('{term}第{n}天', { term: term(detail.termName), n: detail.termDay })}</dd>
          <dt>{term('建除')}</dt>
          <dd>{term(detail.duty)}日</dd>
          <dt>{term('值神')}</dt>
          <dd>{term(detail.twelveStar)}</dd>
          <dt>{term('星宿')}</dt>
          <dd>{term(detail.twentyEightStar)}宿</dd>
        </dl>
        <TagBlock title={term('宜')} kind="good" items={detail.recommends.map(term)} />
        <TagBlock title={term('忌')} kind="bad" items={detail.avoids.map(term)} />
        <TagBlock title={term('吉神')} kind="neutral" items={detail.goodGods.map(term)} />
        <TagBlock title={term('凶煞')} kind="neutral" items={detail.badGods.map(term)} />
        <button className="primary block" onClick={() => onPickBazi(selected)}>
          {t('以此日排八字 →')}
        </button>
        <fieldset className="holiday-choice">
          <legend>{t('节假日')}</legend>
          <label>
            <input
              type="checkbox"
              checked={holidays.china}
              onChange={() => updateHolidays({ ...holidays, china: !holidays.china })}
            />
            {t('中国')}
          </label>
          {(Object.keys(REGIONS) as RegionCode[]).map((code) => (
            <label key={code}>
              <input type="checkbox" checked={holidays.regions.includes(code)} onChange={() => toggleRegion(code)} />
              {t(REGIONS[code].name)}
            </label>
          ))}
        </fieldset>
        <fieldset className="holiday-choice">
          <legend>{t('命盘')}</legend>
          {(
            [
              ['birthday', t('生日')],
              ['clash', t('冲合')],
              ['fortune', t('交运与太岁')],
              ['western', t('星盘')],
            ] as const
          ).map(([item, label]) => (
            <label key={item}>
              <input type="checkbox" checked={chartDays.items.includes(item)} onChange={() => chartDays.toggleItem(item)} />
              {label}
            </label>
          ))}
          <small className="muted holiday-hint">
            {chartDays.charts.length === 0
              ? t('在左侧「命盘」里保存命盘后，它们的生日、冲合、交运等日子会显示在日历上。')
              : t('显示 {shown} / {total} 张命盘，可在左侧「命盘」里勾选。', { shown: chartDays.shown.length, total: chartDays.charts.length })}
          </small>
        </fieldset>
      </aside>
    </div>
  )
}

/** How much the page's CSS zoom (显示大小) scales what getBoundingClientRect measures */
const zoomOf = (el: HTMLElement) => (el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1)

/** The branch of the 干支 year that most of a Gregorian year falls in (from 立春) */
const yearBranch = (year: number) => SolarDay.fromYmd(year, 6, 1).getSixtyCycleDay().getYear().getEarthBranch().getName()

function TagBlock({ title, kind, items }: { title: string; kind: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="tag-block">
      <span className={`tag-title ${kind}`}>{title}</span>
      <p>{items.join(' ')}</p>
    </div>
  )
}
