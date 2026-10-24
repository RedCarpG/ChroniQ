import type { SolarDay } from 'tyme4ts'
import { WEEKDAYS_EN, enMonth, sameDay, weekTitles, type MiniMonth, type WeekDay, type WeekStart } from '../lib/calendar'
import { useSettings, useT, useTerm } from '../settingsContext'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] // tyme4ts index: 0 = Sunday
const PREVIEW = 4 // 宜忌 items shown per day

/** Seven day cards with 建除 and a short 宜忌 preview. */
export function WeekView({
  days,
  selected,
  onSelect,
  showGanzhi,
}: {
  days: WeekDay[]
  selected: SolarDay
  onSelect: (day: SolarDay) => void
  showGanzhi: boolean
}) {
  const term = useTerm()
  const t = useT()
  const en = useSettings().language === 'en'
  return (
    <div className="week-view">
      {days.map((d) => (
        <button
          key={d.key}
          type="button"
          className={[
            'week-day',
            d.isToday && 'today',
            d.isWeekend && 'weekend',
            sameDay(d.solar, selected) && 'selected',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onSelect(d.solar)}
        >
          <span className="wd-head">
            <span className="wd-name">
              {en ? WEEKDAYS_EN[d.solar.getWeek().getIndex()] : `周${WEEKDAYS[d.solar.getWeek().getIndex()]}`}
            </span>
            {d.holiday && <span className={`badge ${d.holiday === '休' ? 'off' : 'work'}`}>{t(d.holiday)}</span>}
          </span>
          <span className="num">{d.day}</span>
          <span className={`sub ${d.subKind}`}>{term(d.sub)}</span>
          {showGanzhi && <span className="gz">{d.ganzhi}</span>}
          <span className="wd-duty">{term(d.duty)}日</span>
          <span className="wd-list">
            <b className="good">{term('宜')}</b>
            {d.recommends.slice(0, PREVIEW).map(term).join(' ') || '—'}
          </span>
          <span className="wd-list">
            <b className="bad">{term('忌')}</b>
            {d.avoids.slice(0, PREVIEW).map(term).join(' ') || '—'}
          </span>
        </button>
      ))}
    </div>
  )
}

/** Twelve mini months; 节气 and festivals are coloured and listed per month. */
export function YearView({
  months,
  weekStart,
  selected,
  onSelect,
  onOpenMonth,
}: {
  months: MiniMonth[]
  weekStart: WeekStart
  selected: SolarDay
  onSelect: (day: SolarDay) => void
  onOpenMonth: (month: number) => void
}) {
  const term = useTerm()
  const t = useT()
  const en = useSettings().language === 'en'
  const titles = weekTitles(weekStart)
  return (
    <div className="year-view">
      {months.map((m) => {
        const marks = m.days.filter((d) => d.termName || d.festival)
        return (
          <section key={m.month} className="mini-month">
            <button type="button" className="mini-title" onClick={() => onOpenMonth(m.month)}>
              {en ? enMonth(m.month) : `${m.month}月`}
            </button>
            <div className="mini-grid mini-head">
              {titles.map((w) => (
                <span key={w.index} className={w.weekend ? 'weekend' : undefined}>
                  {en ? WEEKDAYS_EN[w.index].slice(0, 2) : w.name}
                </span>
              ))}
            </div>
            <div className="mini-grid">
              {Array.from({ length: m.lead }, (_, i) => (
                <span key={`lead-${i}`} />
              ))}
              {m.days.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  title={[term(d.sub), d.ganzhi].join(' ')}
                  className={[
                    'mini-day',
                    d.isWeekend && 'weekend',
                    d.holiday === '休' && 'off',
                    d.termName && 'term',
                    d.festival && 'festival',
                    d.isToday && 'today',
                    sameDay(d.solar, selected) && 'selected',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSelect(d.solar)}
                >
                  {d.day}
                </button>
              ))}
            </div>
            {marks.length > 0 && (
              <ul className="mini-marks">
                {marks.map((d) => {
                  // 清明 + 清明节, 冬至 + 冬至节: show the festival only
                  const showTerm = d.termName && !d.festival?.startsWith(d.termName)
                  return (
                    <li key={d.key}>
                      <span className="muted">{t('{day}日', { day: d.day })}</span>{' '}
                      {showTerm && <span className="term">{term(d.termName!)}</span>}
                      {showTerm && d.festival && ' · '}
                      {d.festival && <span className="festival">{term(d.festival)}</span>}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
