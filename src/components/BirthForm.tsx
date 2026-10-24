import { useState, type ReactNode } from 'react'
import type { BaziInput } from '../lib/bazi'
import { CITIES } from '../lib/solarTime'

interface Props {
  input: BaziInput
  onChange: (input: BaziInput) => void
  /** The page's own 流派设置 panel (八字 and 紫微 each have one) */
  schoolsPanel: ReactNode
  /** Show the 真太阳时 option (not used by 星盘, which works in UTC) */
  trueSolar?: boolean
  /** Extra controls before 流派设置, e.g. the 星盘 birthplace */
  extra?: ReactNode
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

/** Birth date/time, gender, 真太阳时 and 流派设置 — shared by 八字 and 紫微. */
export function BirthForm({ input, onChange, schoolsPanel, trueSolar = true, extra }: Props) {
  const [showSchools, setShowSchools] = useState(false)
  const city = CITIES.find((c) => c.longitude === input.longitude)
  const timeValue = `${pad(input.hour)}:${pad(input.minute)}`
  const change = (patch: Partial<BaziInput>) => onChange({ ...input, ...patch })

  return (
    <section className="card bazi-form">
      <fieldset className="date-parts">
        <legend>出生日期</legend>
        <YearInput
          year={input.year}
          onChange={(year) => change({ year, day: Math.min(input.day, daysIn(year, input.month)) })}
        />
        <select
          aria-label="月"
          value={input.month}
          onChange={(e) => {
            const month = Number(e.target.value)
            change({ month, day: Math.min(input.day, daysIn(input.year, month)) })
          }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1}月
            </option>
          ))}
        </select>
        <select aria-label="日" value={input.day} onChange={(e) => change({ day: Number(e.target.value) })}>
          {Array.from({ length: daysIn(input.year, input.month) }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1}日
            </option>
          ))}
        </select>
      </fieldset>
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
      {trueSolar && (
        <>
          <label className="check">
            <input
              type="checkbox"
              checked={input.longitude != null}
              onChange={(e) => change({ longitude: e.target.checked ? CITIES[0].longitude : undefined })}
            />
            真太阳时
          </label>
          {input.longitude != null && (
            <>
              <label>
                出生地
                <select
                  value={city?.name ?? ''}
                  onChange={(e) => {
                    const c = CITIES.find((x) => x.name === e.target.value)
                    if (c) change({ longitude: c.longitude })
                  }}
                >
                  {!city && <option value="">自定义</option>}
                  {CITIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                东经
                <input
                  type="number"
                  className="narrow"
                  min={73}
                  max={135}
                  step={0.01}
                  value={input.longitude}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (e.target.value !== '' && v >= -180 && v <= 180) change({ longitude: v })
                  }}
                />
              </label>
            </>
          )}
        </>
      )}
      {extra}
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
