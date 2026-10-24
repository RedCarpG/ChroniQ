import { useCallback, useRef, useState } from 'react'
import type { BaziInput } from '../lib/bazi'
import { loadCharts, sameInput, saveCharts, upsertChart, type SavedChart } from '../lib/savedCharts'
import { translate, type Lang } from '../i18n'
import { useSettings, useT } from '../settingsContext'
import { useDismiss } from './useDismiss'
import { TitleMark } from './Logo'

/** id of the spot under the 命盘 tab where a page can portal its own tabs. */
export const DRAWER_RAIL_SLOT = 'drawer-rail-slot'

/**
 * Saved charts in a drawer on the left edge of the screen. Closed, only a
 * slim 命盘 tab shows; open, the panel slides over the page (nothing below
 * moves). Loading a chart closes it again.
 */
export function SavedChartsDrawer({ input, onLoad }: { input: BaziInput; onLoad: (input: BaziInput) => void }) {
  const t = useT()
  const { language } = useSettings()
  const [charts, setCharts] = useState<SavedChart[]>(loadCharts)
  const active = charts.find((c) => sameInput(c.input, input))
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  const update = (next: SavedChart[]) => {
    setCharts(next)
    saveCharts(next)
  }
  const save = () => {
    const finalName = name.trim() || active?.name || t('命盘{n}', { n: charts.length + 1 })
    update(upsertChart(charts, finalName, input))
    setName('')
  }

  return (
    <div className={`drawer${open ? ' open' : ''}`} ref={ref}>
      <aside id="saved-charts" className="drawer-panel" aria-label={t('已保存的命盘')} inert={!open}>
        <div className="drawer-head">
          <h3>
            <TitleMark />
            {t('已保存的命盘')}
          </h3>
          <button type="button" className="chip-x" aria-label={t('收起')} onClick={close}>
            ×
          </button>
        </div>
        <form
          className="saved-form"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <input
            aria-label={t('命盘名称')}
            placeholder={active ? t('已保存为「{name}」', { name: active.name }) : t('为当前命盘命名（可选）')}
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="ghost">
            {name.trim() && charts.some((c) => c.name === name.trim()) ? t('更新') : t('保存')}
          </button>
        </form>
        {charts.length > 0 ? (
          <ul className="saved-list">
            {charts.map((c) => (
              <li key={c.id} className={c === active ? 'on' : undefined}>
                <button
                  type="button"
                  className="saved-item"
                  onClick={() => {
                    onLoad(c.input)
                    close()
                  }}
                >
                  <span className="saved-name">{c.name}</span>
                  <small className="muted">{describe(c.input, language)}</small>
                </button>
                <button
                  type="button"
                  className="chip-x"
                  aria-label={t('删除{name}', { name: c.name })}
                  onClick={() => update(charts.filter((x) => x !== c))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted saved-empty">{t('还没有保存的命盘。填好出生信息后，在上面命名并保存。')}</p>
        )}
        <small className="muted">{t('命盘只保存在本机浏览器中，不会上传。')}</small>
      </aside>
      <div className="drawer-rail">
        <button
          type="button"
          className="drawer-handle"
          aria-expanded={open}
          aria-controls="saved-charts"
          title={t('已保存的命盘')}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="drawer-handle-text">{t('命盘')}</span>
          {charts.length > 0 && <span className="drawer-count">{charts.length}</span>}
        </button>
        {/* Pages can portal their own tabs in here, below the 命盘 tab. */}
        <div id={DRAWER_RAIL_SLOT} className="drawer-rail-slot" />
      </div>
    </div>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')
const describe = (i: BaziInput, lang: Lang) => {
  const t = (text: string) => translate(lang, text)
  return (
    `${i.year}-${pad(i.month)}-${pad(i.day)} ${pad(i.hour)}:${pad(i.minute)} ${i.gender === 1 ? t('男') : t('女')}` +
    (i.place ? ` · ${t(i.place.name)}${i.trueSolar ? t('（真太阳时）') : ''}` : '')
  )
}
