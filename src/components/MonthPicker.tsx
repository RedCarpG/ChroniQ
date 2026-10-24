import { useRef, useState } from 'react'
import { SolarDay } from 'tyme4ts'
import { enMonth, todaySolar } from '../lib/calendar'
import { useSettings, useT } from '../settingsContext'
import { useDismiss } from './useDismiss'

interface Props {
  year: number
  month: number
  minYear: number
  maxYear: number
  onPickMonth: (year: number, month: number) => void
  onPickDay: (day: SolarDay) => void
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Calendar-icon button opening a year grid, month grid and jump-to-date panel. */
export function MonthPicker({ year, month, minYear, maxYear, onPickMonth, onPickDay }: Props) {
  const t = useT()
  const en = useSettings().language === 'en'
  const [open, setOpen] = useState(false)
  // Year shown in the month grid while browsing; committed when a month is picked.
  const [draftYear, setDraftYear] = useState(year)
  const [pageStart, setPageStart] = useState(() => year - (year % 12))
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, open, () => setOpen(false))

  const today = todaySolar()
  const years = Array.from({ length: 12 }, (_, i) => pageStart + i)

  const toggle = () => {
    if (!open) {
      setDraftYear(year)
      setPageStart(year - (year % 12))
    }
    setOpen((v) => !v)
  }

  return (
    <div className="month-picker" ref={ref}>
      <button type="button" className="icon-btn" aria-label={t('选择年月')} aria-expanded={open} onClick={toggle}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2zm12 8H5v9h14zM7 12h3v3H7z"
          />
        </svg>
      </button>
      {open && (
        <div className="picker-panel" role="dialog" aria-label={t('选择年月')}>
          <div className="picker-head">
            <button type="button" aria-label={t('前十二年')} disabled={pageStart <= minYear} onClick={() => setPageStart((p) => p - 12)}>
              ‹
            </button>
            <span>
              {Math.max(pageStart, minYear)} – {Math.min(pageStart + 11, maxYear)}
            </span>
            <button type="button" aria-label={t('后十二年')} disabled={pageStart + 11 >= maxYear} onClick={() => setPageStart((p) => p + 12)}>
              ›
            </button>
          </div>
          <div className="picker-grid">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                disabled={y < minYear || y > maxYear}
                className={[y === draftYear && 'on', y === today.getYear() && 'now'].filter(Boolean).join(' ') || undefined}
                onClick={() => setDraftYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
          <div className="picker-sep" />
          <div className="picker-grid">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                type="button"
                className={
                  [
                    draftYear === year && m === month && 'on',
                    draftYear === today.getYear() && m === today.getMonth() && 'now',
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                onClick={() => {
                  onPickMonth(draftYear, m)
                  setOpen(false)
                }}
              >
                {en ? enMonth(m, 'short') : `${m}月`}
              </button>
            ))}
          </div>
          <div className="picker-foot">
            <input
              type="date"
              aria-label={t('跳到日期')}
              min={`${minYear}-01-01`}
              max={`${maxYear}-12-31`}
              defaultValue={`${year}-${pad(month)}-01`}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split('-').map(Number)
                if (y >= minYear && y <= maxYear && m && d) {
                  onPickDay(SolarDay.fromYmd(y, m, d))
                  setOpen(false)
                }
              }}
            />
            <button
              type="button"
              className="primary"
              onClick={() => {
                onPickDay(today)
                setOpen(false)
              }}
            >
              {t('今天')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
