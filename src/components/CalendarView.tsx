import { useMemo, useState } from 'react'
import { SolarDay } from 'tyme4ts'
import { Char } from './Char'
import { MonthPicker } from './MonthPicker'
import { WeekView, YearView } from './CalendarViews'
import {
  WEEKDAYS_EN,
  buildDayDetail,
  buildMonthGrid,
  buildWeek,
  buildYear,
  enDate,
  enMonth,
  sameDay,
  todaySolar,
  weekTitles,
} from '../lib/calendar'
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
  )
  const weekDays = useMemo(() => (mode === 'week' ? buildWeek(selected, weekStart) : []), [mode, selected, weekStart])
  const yearMonths = useMemo(() => (mode === 'year' ? buildYear(view.year, weekStart) : []), [mode, view.year, weekStart])
  const monthDay = (d: SolarDay) =>
    en ? enDate(d.getYear(), d.getMonth(), d.getDay(), { day: 'numeric', month: 'short' }) : `${d.getMonth()}月${d.getDay()}日`
  const weekRange = weekDays.length > 0 ? `${monthDay(weekDays[0].solar)} – ${monthDay(weekDays[6].solar)}` : ''
  const detail = useMemo(() => buildDayDetail(selected), [selected])

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
            <div className="grid days">
              {cells.map((c) => (
                <button
                  key={c.key}
                  className={[
                    'day',
                    !c.inMonth && 'out',
                    c.isToday && 'today',
                    c.isWeekend && 'weekend',
                    sameDay(c.solar, selected) && 'selected',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => select(c.solar)}
                >
                  {c.holiday && <span className={`badge ${c.holiday === '休' ? 'off' : 'work'}`}>{t(c.holiday)}</span>}
                  <span className="num">{c.day}</span>
                  <span className={`sub ${c.subKind}`}>{term(c.sub)}</span>
                  {dayGanzhi === 'show' && <span className="gz">{c.ganzhi}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {mode === 'week' && (
          <WeekView days={weekDays} selected={selected} onSelect={select} showGanzhi={dayGanzhi === 'show'} />
        )}

        {mode === 'year' && (
          <YearView
            months={yearMonths}
            weekStart={weekStart}
            selected={selected}
            onSelect={select}
            onOpenMonth={(month) => {
              setView((v) => ({ ...v, month }))
              setMode('month')
            }}
          />
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
        {detail.festivals.length > 0 && (
          <div className="tags">
            {detail.festivals.map((f) => (
              <span key={f} className="tag festival">
                {term(f)}
              </span>
            ))}
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
      </aside>
    </div>
  )
}

function TagBlock({ title, kind, items }: { title: string; kind: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="tag-block">
      <span className={`tag-title ${kind}`}>{title}</span>
      <p>{items.join(' ')}</p>
    </div>
  )
}
