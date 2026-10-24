import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useCalendarHidden, useSavedCharts } from './chartStore'
import type { BaziInput } from '../lib/bazi'
import { sameInput, upsertChart } from '../lib/savedCharts'
import { translate, type Lang } from '../i18n'
import { useSettings, useT } from '../settingsContext'
import { useDismiss } from './useDismiss'
import { TitleMark } from './Logo'

/** id of the spot under the 命盘 tab where a page can portal its own tabs. */
export const DRAWER_RAIL_SLOT = 'drawer-rail-slot'
/** id of the drawer's panel for a page's own tab (DrawerPageTab) */
const DRAWER_PAGE_PANEL = 'drawer-page-panel'

// Which of the drawer's tabs is open, if any: its own 命盘, or the page's (shared with DrawerPageTab)
type DrawerTab = 'charts' | 'page' | null
let openTab: DrawerTab = null
const listeners = new Set<() => void>()
const setOpenTab = (next: DrawerTab | ((tab: DrawerTab) => DrawerTab)) => {
  openTab = typeof next === 'function' ? next(openTab) : next
  listeners.forEach((l) => l())
}
function useOpenTab() {
  const tab = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => openTab,
  )
  return [tab, setOpenTab] as const
}

/**
 * A page's own tab in the left drawer, under 命盘 (the calendar's 显示): its handle goes in the
 * rail, its contents in the drawer's panel, which slides out as for 命盘.
 */
export function DrawerPageTab({ label, title, count, children }: { label: string; title: string; count: number; children: ReactNode }) {
  const t = useT()
  const [tab, setTab] = useOpenTab()
  const [slots, setSlots] = useState<{ rail: HTMLElement; panel: HTMLElement } | null>(null)
  useEffect(() => {
    const rail = document.getElementById(DRAWER_RAIL_SLOT)
    const panel = document.getElementById(DRAWER_PAGE_PANEL)
    if (rail && panel) setSlots({ rail, panel })
    // Leaving the page closes its tab
    return () => setTab((open) => (open === 'page' ? null : open))
  }, [setTab])
  if (!slots) return null
  return (
    <>
      {createPortal(
        <button
          type="button"
          className="drawer-handle quiet"
          aria-expanded={tab === 'page'}
          aria-controls={DRAWER_PAGE_PANEL}
          title={title}
          onClick={() => setTab(tab === 'page' ? null : 'page')}
        >
          <span className="drawer-handle-text">{label}</span>
          {count > 0 && <span className="drawer-count">{count}</span>}
        </button>,
        slots.rail,
      )}
      {createPortal(
        <>
          <div className="drawer-head">
            <h3>
              <TitleMark />
              {title}
            </h3>
            <button type="button" className="chip-x" aria-label={t('收起')} onClick={() => setTab(null)}>
              ×
            </button>
          </div>
          {children}
        </>,
        slots.panel,
      )}
    </>
  )
}

/**
 * Saved charts in a drawer on the left edge of the screen. Closed, only a
 * slim 命盘 tab shows; open, the panel slides over the page (nothing below
 * moves). Loading a chart closes it again. On the calendar page each chart
 * also gets a 日历 tick: whether its dates show on the calendar.
 */
export function SavedChartsDrawer({
  input,
  onLoad,
  calendar = false,
}: {
  input: BaziInput
  onLoad: (input: BaziInput) => void
  /** On the calendar page: show the 日历 ticks */
  calendar?: boolean
}) {
  const t = useT()
  const { language } = useSettings()
  const [charts, update] = useSavedCharts()
  const [hidden, toggleHidden] = useCalendarHidden()
  const active = charts.find((c) => sameInput(c.input, input))
  const [name, setName] = useState('')
  const [tab, setTab] = useOpenTab()
  const open = tab !== null
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setTab(null), [setTab])
  useDismiss(ref, open, close)

  const save = () => {
    const finalName = name.trim() || active?.name || t('命盘{n}', { n: charts.length + 1 })
    update(upsertChart(charts, finalName, input))
    setName('')
  }

  return (
    <div className={`drawer${open ? ' open' : ''}`} ref={ref}>
      <aside className="drawer-panel" inert={!open}>
        <div id="saved-charts" className="drawer-section" aria-label={t('已保存的命盘')} hidden={tab === 'page'}>
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
                {calendar && (
                  <label className="saved-calendar" title={t('在日历上显示这张命盘的日子')}>
                    <input type="checkbox" checked={!hidden.includes(c.id)} onChange={() => toggleHidden(c.id)} />
                    {t('日历')}
                  </label>
                )}
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
        </div>
        {/* A page's own tab shows here (DrawerPageTab) */}
        <div id={DRAWER_PAGE_PANEL} className="drawer-section" hidden={tab !== 'page'} />
      </aside>
      <div className="drawer-rail">
        <button
          type="button"
          className="drawer-handle"
          aria-expanded={tab === 'charts'}
          aria-controls="saved-charts"
          title={t('已保存的命盘')}
          onClick={() => setTab(tab === 'charts' ? null : 'charts')}
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
