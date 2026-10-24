import { InfoTip } from './InfoTip'
import { SCHOOLS, optionLabel, type SchoolKey, type SchoolSettings } from '../lib/schools'
import { useT } from '../settingsContext'

/** Small "!" that explains a result depends on a 流派 choice. Opens on hover / tap. */
export function SchoolMark({ school, settings }: { school: SchoolKey; settings: SchoolSettings }) {
  const t = useT()
  const info = SCHOOLS[school]
  // The chosen option goes in bold between the words around it.
  const [before, after] = t('当前：{option}（可在「流派设置」中更改）').split('{option}')
  // Same portalled bubble as the glossary tips, so table cells (nowrap) and
  // scrolling containers (岁运盘) can neither squeeze nor clip it.
  return (
    <InfoTip
      className="plain school-mark"
      label={
        <span className="school-dot" aria-label={t('流派差异：{title}', { title: t(info.title) })}>
          !
        </span>
      }
      title={t(info.title)}
    >
      <span>{t(info.summary)}</span>
      <span>
        {before}
        <b>{t(optionLabel(school, settings))}</b>
        {after}
      </span>
    </InfoTip>
  )
}

interface SchoolRegistryEntry {
  title: string
  summary: string
  options: { value: string; label: string; source: string }[]
}

/**
 * Selects for every rule in a 流派 registry (八字 SCHOOLS by default, or the
 * 紫微 ZIWEI_SCHOOLS), each with its summary and the chosen option's source.
 */
export function SchoolSettingsPanel<S extends { [K in keyof S]: string }>({
  settings,
  onChange,
  registry = SCHOOLS as unknown as Record<keyof S, SchoolRegistryEntry>,
}: {
  settings: S
  onChange: (settings: S) => void
  registry?: Record<keyof S, SchoolRegistryEntry>
}) {
  const t = useT()
  return (
    <div className="school-panel">
      {(Object.keys(registry) as (keyof S & string)[]).map((key) => {
        const info = registry[key]
        const current = info.options.find((o) => o.value === settings[key])
        return (
          <label key={key} className="school-item">
            <span className="school-title">{t(info.title)}</span>
            <select
              value={settings[key]}
              onChange={(e) => onChange({ ...settings, [key]: e.target.value })}
            >
              {info.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.label)}
                </option>
              ))}
            </select>
            <small className="muted">{t(info.summary)}</small>
            {current && <small className="school-source">{t('出处：{source}', { source: t(current.source) })}</small>}
          </label>
        )
      })}
    </div>
  )
}
