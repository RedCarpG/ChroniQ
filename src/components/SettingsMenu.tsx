import { useRef, useState } from 'react'
import { SETTING_OPTIONS, type Settings } from '../lib/settings'
import { useT } from '../settingsContext'
import { useDismiss } from './useDismiss'

/** Chosen on the calendar itself (its 显示 tab), not here */
const CALENDAR_ONLY: (keyof Settings)[] = ['dayGanzhi', 'moonPhase', 'dipper', 'weekStart']

/** Gear button in the top bar opening display settings. */
export function SettingsMenu({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useDismiss(ref, open, () => setOpen(false))

  return (
    <div className="settings" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label={t('设置')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
            transform="translate(-1 0)"
          />
        </svg>
      </button>
      {open && (
        <div className="settings-panel" role="dialog" aria-label={t('设置')}>
          {/* What the calendar shows and 每周起始 are chosen on the calendar itself (its 显示 tab) */}
          {(Object.keys(SETTING_OPTIONS) as (keyof Settings)[]).filter((key) => !CALENDAR_ONLY.includes(key)).map((key) => (
            <div key={key} className="setting-row">
              <span className="setting-title">{t(SETTING_OPTIONS[key].title)}</span>
              <div className="seg small" role="group" aria-label={t(SETTING_OPTIONS[key].title)}>
                {SETTING_OPTIONS[key].options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={settings[key] === o.value ? 'on' : undefined}
                    aria-pressed={settings[key] === o.value}
                    onClick={() => onChange({ ...settings, [key]: o.value })}
                  >
                    {t(o.label)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
