import { parseTime } from '../lib/dateInput'
import { toUtc } from '../lib/timeZone'
import { useState, type ReactNode } from 'react'
import type { BaziInput } from '../lib/bazi'
import { DEFAULT_PLACE } from '../lib/place'
import type { Lang } from '../i18n'
import { useSettings, useT } from '../settingsContext'
import { PlacePicker } from './PlacePicker'
import { openChartsDrawer } from './SavedCharts'

type T = ReturnType<typeof useT>

interface Props {
  input: BaziInput
  onChange: (input: BaziInput) => void
  /** The page's own 流派设置 panel (八字 and 紫微 each have one) */
  schoolsPanel: ReactNode
  /** Show the 真太阳时 option (not used by 星盘, which works in UTC) */
  trueSolar?: boolean
  /** Whether it may fold to one line (on a phone): not in the 命盘 drawer, where it is shown whole */
  folding?: boolean
  /** Whether 流派设置 is in it: not in the 命盘 drawer, which is for the birth (天书 puts it by the chart) */
  withSchools?: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')
/** Days in a solar month */
const daysIn = (year: number, month: number) => new Date(year, month, 0).getDate()
const MIN_YEAR = 1900
const MAX_YEAR = 2100

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** Month name for the month select: "May" (English, short) or 5月 */
const monthText = (lang: Lang, month: number) => (lang === 'en' ? MONTH_NAMES[month - 1].slice(0, 3) : `${month}月`)
/** A month and day, e.g. "May 15" or 5月15日 */
export const monthDayText = (lang: Lang, month: number, day: number) =>
  lang === 'en' ? `${MONTH_NAMES[month - 1]} ${day}` : `${month}月${day}日`
/** A solar date, e.g. "May 15, 1990" or 1990年5月15日 */
export const dateText = (lang: Lang, d: { year: number; month: number; day: number }) =>
  lang === 'en' ? `${MONTH_NAMES[d.month - 1]} ${d.day}, ${d.year}` : `${d.year}年${d.month}月${d.day}日`
/** A solar date and clock time, e.g. "May 15, 1990 10:30" or 1990年5月15日 10:30 */
export const dateTimeText = (lang: Lang, d: { year: number; month: number; day: number; hour: number; minute: number }) =>
  `${dateText(lang, d)} ${pad(d.hour)}:${pad(d.minute)}`

/**
 * Year typed straight in (or stepped with the arrows / arrow keys), instead of
 * paging a date picker month by month. Half-typed years stay in the box and
 * only a full year in range changes the chart.
 */
/** 年 / 月 / 日 controls: the year typed or stepped, month and day picked. */
export function DateParts({
  label,
  value,
  onChange,
}: {
  label: string
  value: { year: number; month: number; day: number }
  onChange: (date: { year: number; month: number; day: number }) => void
}) {
  const { year, month, day } = value
  const t = useT()
  const { language } = useSettings()
  return (
    <fieldset className="date-parts">
      <legend>{label}</legend>
      <YearInput year={year} onChange={(y) => onChange({ year: y, month, day: Math.min(day, daysIn(y, month)) })} />
      <select
        aria-label={t('月')}
        value={month}
        onChange={(e) => {
          const m = Number(e.target.value)
          onChange({ year, month: m, day: Math.min(day, daysIn(year, m)) })
        }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i} value={i + 1}>
            {monthText(language, i + 1)}
          </option>
        ))}
      </select>
      <select aria-label={t('日')} value={day} onChange={(e) => onChange({ year, month, day: Number(e.target.value) })}>
        {Array.from({ length: daysIn(year, month) }, (_, i) => (
          <option key={i} value={i + 1}>
            {language === 'en' ? i + 1 : `${i + 1}日`}
          </option>
        ))}
      </select>
    </fieldset>
  )
}

function YearInput({ year, onChange }: { year: number; onChange: (year: number) => void }) {
  const t = useT()
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (text: string) => {
    const y = Number(text)
    if (/^\d{4}$/.test(text) && y >= MIN_YEAR && y <= MAX_YEAR) onChange(y)
  }
  return (
    <input
      type="number"
      className="year-input"
      aria-label={t('年')}
      inputMode="numeric"
      min={MIN_YEAR}
      max={MAX_YEAR}
      value={draft ?? year}
      onChange={(e) => {
        setDraft(e.target.value)
        commit(e.target.value)
      }}
      onFocus={(e) => e.target.select()}
      onBlur={() => setDraft(null)}
    />
  )
}

/** The birth in one line: 1990年5月17日 10:30 · 男 · 北京 (· 真太阳时) */
export const birthSummary = (t: T, input: BaziInput, trueSolar = true) =>
  [
    t('{y}年{m}月{d}日', { y: input.year, m: input.month, d: input.day }) + ` ${pad(input.hour)}:${pad(input.minute)}`,
    input.gender === 1 ? t('男') : t('女'),
    t((input.place ?? DEFAULT_PLACE).name),
    ...(trueSolar && input.trueSolar ? [t('真太阳时')] : []),
  ].join(' · ')

/** 天书: the birth, written small by a chart's switches; a tap opens the 命盘 drawer, where it is changed */
export function BirthChip({ input, trueSolar = true }: { input: BaziInput; trueSolar?: boolean }) {
  const t = useT()
  return (
    <button type="button" className="birth-chip" title={t('在左侧「命盘」里修改出生信息')} onClick={openChartsDrawer}>
      <span>{birthSummary(t, input, trueSolar)}</span>
      <span className="birth-chip-edit">{t('修改')}</span>
    </button>
  )
}

/** Birth date/time, gender, birthplace, 真太阳时 and 流派设置 — shared by 八字, 紫微 and 星盘. */
export function BirthForm({ input, onChange, schoolsPanel, trueSolar = true, folding = true, withSchools = true }: Props) {
  const t = useT()
  const [showSchools, setShowSchools] = useState(false)
  // On a phone the form folds to one line (the birth in short, and 修改), so the chart is what the page
  // opens on; it unfolds on a tap. On a wider screen the line is not shown and the form always is.
  const [folded, setFolded] = useState(true)
  const summary = birthSummary(t, input, trueSolar)
  const timeValue = `${pad(input.hour)}:${pad(input.minute)}`
  const [timeError, setTimeError] = useState(false)
  const resolution = toUtc(input, (input.place ?? DEFAULT_PLACE).timeZone).resolution
  const change = (patch: Partial<BaziInput>) => {
    const next = { ...input, ...patch }
    const gap = toUtc(next, (next.place ?? DEFAULT_PLACE).timeZone).resolution === 'gap'
    setTimeError(gap)
    if (!gap) onChange(next)
  }

  return (
    <section className={`card bazi-form${folding && folded ? ' folded' : ''}`}>
      {folding && (
        <button type="button" className="bazi-form-summary" aria-expanded={!folded} onClick={() => setFolded((f) => !f)}>
          <span>{summary}</span>
          <span className="bazi-form-edit">{folded ? t('修改') : t('收起')}</span>
        </button>
      )}
      <DateParts label={t('出生日期')} value={input} onChange={(d) => change(d)} />
      <label>
        {t('出生时间')}
        <input
          type="time"
          value={timeValue}
          onChange={(e) => {
            const time = parseTime(e.target.value)
            if (time) change(time)
          }}
        />
      </label>
      {timeError && <p role="alert">{t('该本地时间因夏令时跳变而不存在，请选择其他时间。')}</p>}
      {resolution === 'overlap' && <p role="status">{t('该时间因夏令时回拨出现两次，采用较早的一次。')}</p>}
      <div className="seg" role="group" aria-label={t('性别')}>
        {(['男', '女'] as const).map((g, i) => (
          <button
            key={g}
            className={input.gender === 1 - i ? 'on' : undefined}
            onClick={() => change({ gender: (1 - i) as 0 | 1 })}
          >
            {g === '男' ? t('男') : t('女')}
          </button>
        ))}
      </div>
      <PlacePicker label={t('出生地')} place={input.place ?? DEFAULT_PLACE} onChange={(place) => change({ place })} />
      {trueSolar && (
        <label className="check" title={t('按出生地经度与时区，把钟表时间换算成当地真太阳时再排盘')}>
          <input type="checkbox" checked={!!input.trueSolar} onChange={(e) => change({ trueSolar: e.target.checked })} />
          {t('真太阳时')}
        </label>
      )}
      {withSchools && (
        <>
          <button
            type="button"
            className={`ghost${showSchools ? ' on' : ''}`}
            aria-expanded={showSchools}
            onClick={() => setShowSchools((v) => !v)}
          >
            {t('流派设置')}
          </button>
          {showSchools && schoolsPanel}
        </>
      )}
    </section>
  )
}
