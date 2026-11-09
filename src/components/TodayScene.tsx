// 天书's 今日: the day as one page of the almanac, a scene as the 命理 pages' 简洁 are. In the middle, the
// day's number large, the Gregorian date under it, the Moon of the day beside it, the lunar date down its
// right in gold, and the year's, month's and day's pillars under it. Down the left, the 节气 and the day of
// it, the 建除, the festivals, the Moon's phase; down the right, the 宜 and the 忌. What is in the sky today
// and tonight, and what is coming, follow under the scene (TodayPage's own sections).
import '@fontsource/zcool-xiaowei/400.css'
import type { DayDetail } from '../lib/calendar'
import { enDate } from '../lib/calendar'
import type { ElementName } from '../lib/bazi'
import { hanNumber } from '../lib/hanNumber'
import type { MoonDay } from '../lib/moon'
import { useSettings, useT, useTerm } from '../settingsContext'
import { MoonGlyph } from './MoonGlyph'

const EL_VAR: Record<ElementName, string> = { 木: 'var(--wood)', 火: 'var(--fire)', 土: 'var(--earth)', 金: 'var(--metal)', 水: 'var(--water)' }
/** How many of the 宜 and the 忌 the scene names: the rest are in the 日历's detail */
const SHOWN = 6

export function TodayScene({
  date,
  detail,
  moon,
  onViewMoon,
  hint,
}: {
  date: { year: number; month: number; day: number }
  detail: DayDetail
  moon: MoonDay
  onViewMoon: () => void
  /** A line under the pillars: what choosing a chart would add */
  hint?: string
}) {
  const t = useT()
  const term = useTerm()
  const { language } = useSettings()
  const en = language === 'en'
  // Set down the page in columns, numbers are written out (an Arabic one would lie on its side)
  const num = (n: number) => (en ? String(n) : hanNumber(n))
  const gap = en ? ' · ' : '　'
  // 15:02 as 十五时〇二分, down the column
  const clock = (hm: string) => {
    const [h, m] = hm.split(':').map(Number)
    return en ? hm : `${hanNumber(h)}时${m === 0 ? '整' : `${m < 10 ? '〇' : ''}${hanNumber(m)}分`}`
  }
  const { year, month, day } = date
  const [y] = detail.pillars
  const yi = detail.recommends.slice(0, SHOWN)
  const ji = detail.avoids.slice(0, SHOWN)
  return (
    <section className="today-scene" aria-label={t('今日')}>
      {/* Down the left: the 节气 and the day of it, the 建除, the festivals, the Moon */}
      <div className="td-margin">
        <span className="ts-kicker" aria-hidden="true">
          Today
        </span>
        <b>{t('{term}第{n}天', { term: term(detail.termName), n: num(detail.termDay) })}</b>
        <span>
          {t('{duty}日', { duty: term(detail.duty) })}
          {gap}
          {t(detail.constellation)}
        </span>
        {detail.festivals.length > 0 && <span className="td-festival">{detail.festivals.map((f) => term(f)).join(gap)}</span>}
        <span>
          {t('月相{name}', { name: t(moon.name) })}
          {moon.time && `${gap}${clock(moon.time)}`}
        </span>
      </div>
      {/* The day: its number, the Moon beside it, the lunar date down its right */}
      <div className="td-day">
        <button type="button" className="td-moon" title={t('观月 →')} onClick={onViewMoon}>
          <MoonGlyph moon={moon} />
          <small>{t('照亮 {pct}%', { pct: Math.round(moon.lit * 100) })}</small>
        </button>
        <div className="td-num">
          <b>{day}</b>
          <span>
            {en
              ? enDate(year, month, day, { month: 'long', year: 'numeric' })
              : `${year} · ${enDate(year, month, day, { month: 'long' }).toUpperCase()}`}
            {gap}
            {en ? enDate(year, month, day, { weekday: 'long' }) : detail.weekText}
          </span>
        </div>
        <div className="td-lunar">
          <b>{term(detail.lunarText)}</b>
          <small>
            {t('{ganzhi}年', { ganzhi: term(y.stem.char + y.branch.char) })}
            {gap}
            {t('属{zodiac}', { zodiac: term(detail.zodiac) })}
          </small>
        </div>
      </div>
      {/* The day's three pillars */}
      <div className="td-pillars" aria-label={t('年、月、日三柱')}>
        {detail.pillars.map((p, i) => (
          <div key={p.label} className={i === 2 ? 'd' : undefined}>
            <small>{term(p.label)}</small>
            <b style={{ color: EL_VAR[p.stem.element] }}>{p.stem.char}</b>
            <b style={{ color: EL_VAR[p.branch.element] }}>{p.branch.char}</b>
          </div>
        ))}
      </div>
      {/* Down the right: the 宜 and the 忌 */}
      <div className="td-yiji">
        {ji.length > 0 && (
          <div className="td-ji">
            <i>{term('忌')}</i>
            {ji.map((a) => (
              <span key={a}>{term(a)}</span>
            ))}
          </div>
        )}
        {yi.length > 0 && (
          <div className="td-yi">
            <i>{term('宜')}</i>
            {yi.map((a) => (
              <span key={a}>{term(a)}</span>
            ))}
          </div>
        )}
      </div>
      {hint && <p className="td-hint">{hint}</p>}
    </section>
  )
}
