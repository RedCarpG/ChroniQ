import { useState, type ReactNode } from 'react'
import type { BaziInput } from '../lib/bazi'
import { DEFAULT_PLACE } from '../lib/place'
import { PlacePicker } from './PlacePicker'

interface Props {
  input: BaziInput
  onChange: (input: BaziInput) => void
  /** The page's own 流派设置 panel (八字 and 紫微 each have one) */
  schoolsPanel: ReactNode
  /** Show the 真太阳时 option (not used by 星盘, which works in UTC) */
  trueSolar?: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')
/** Days in a solar month */
const daysIn = (year: number, month: number) => new Date(year, month, 0).getDate()
const MIN_YEAR = 1900
const MAX_YEAR = 2100

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
  return (
    <fieldset className="date-parts">
      <legend>{label}</legend>
      <YearInput year={year} onChange={(y) => onChange({ year: y, month, day: Math.min(day, daysIn(y, month)) })} />
      <select
        aria-label="月"
        value={month}
        onChange={(e) => {
          const m = Number(e.target.value)
          onChange({ year, month: m, day: Math.min(day, daysIn(year, m)) })
        }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i} value={i + 1}>
            {i + 1}月
          </option>
        ))}
      </select>
      <select aria-label="日" value={day} onChange={(e) => onChange({ year, month, day: Number(e.target.value) })}>
        {Array.from({ length: daysIn(year, month) }, (_, i) => (
          <option key={i} value={i + 1}>
            {i + 1}日
          </option>
        ))}
      </select>
    </fieldset>
  )
}

function YearInput({ year, onChange }: { year: number; onChange: (year: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (text: string) => {
    const y = Number(text)
    if (/^\d{4}$/.test(text) && y >= MIN_YEAR && y <= MAX_YEAR) onChange(y)
  }
  return (
    <input
      type="number"
      className="year-input"
      aria-label="年"
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

/** Birth date/time, gender, birthplace, 真太阳时 and 流派设置 — shared by 八字, 紫微 and 星盘. */
export function BirthForm({ input, onChange, schoolsPanel, trueSolar = true }: Props) {
  const [showSchools, setShowSchools] = useState(false)
  const timeValue = `${pad(input.hour)}:${pad(input.minute)}`
  const change = (patch: Partial<BaziInput>) => onChange({ ...input, ...patch })

  return (
    <section className="card bazi-form">
      <DateParts label="出生日期" value={input} onChange={(d) => change(d)} />
      <label>
        出生时间
        <input
          type="time"
          value={timeValue}
          onChange={(e) => {
            const [h, mi] = e.target.value.split(':').map(Number)
            if (!Number.isNaN(h)) change({ hour: h, minute: mi })
          }}
        />
      </label>
      <div className="seg" role="group" aria-label="性别">
        {(['男', '女'] as const).map((g, i) => (
          <button
            key={g}
            className={input.gender === 1 - i ? 'on' : undefined}
            onClick={() => change({ gender: (1 - i) as 0 | 1 })}
          >
            {g}
          </button>
        ))}
      </div>
      <PlacePicker label="出生地" place={input.place ?? DEFAULT_PLACE} onChange={(place) => change({ place })} />
      {trueSolar && (
        <label className="check" title="按出生地经度与时区，把钟表时间换算成当地真太阳时再排盘">
          <input type="checkbox" checked={!!input.trueSolar} onChange={(e) => change({ trueSolar: e.target.checked })} />
          真太阳时
        </label>
      )}
      <button
        type="button"
        className={`ghost${showSchools ? ' on' : ''}`}
        aria-expanded={showSchools}
        onClick={() => setShowSchools((v) => !v)}
      >
        流派设置
      </button>
      {showSchools && schoolsPanel}
    </section>
  )
}
