import { useCallback, useEffect, useRef, useState } from 'react'
import { useT, useTerm } from '../settingsContext'
import { useDismiss } from './useDismiss'

export type Page = 'calendar' | 'bazi' | 'ziwei' | 'star' | 'sky' | 'solar'

/** The pages, grouped as the menu lists them (shown through t(): src/i18n/__tests__/calendar.test.ts checks the English) */
export const PAGE_GROUPS: { title: string; pages: { page: Page; name: string; desc: string }[] }[] = [
  {
    title: '历法',
    pages: [
      { page: 'calendar', name: '日历', desc: '公历、农历、节气、干支' },
      { page: 'sky', name: '天象', desc: '此刻天空、星座与星官' },
      { page: 'solar', name: '太阳系', desc: '行星的轨道、距离与顺逆行' },
    ],
  },
  {
    title: '命理',
    pages: [
      { page: 'bazi', name: '八字排盘', desc: '四柱、十神、神煞、大运流年' },
      { page: 'ziwei', name: '紫微斗数', desc: '十二宫、四化飞星、运限' },
      { page: 'star', name: '星盘', desc: '本命、行运推运、合盘、组合盘' },
    ],
  },
]
const ALL = PAGE_GROUPS.flatMap((g) => g.pages)

/**
 * Page switcher in the top bar: the current page's name opens a menu of all
 * pages, grouped, each with a line on what it holds. Arrow keys move through
 * the menu, Escape or a click outside closes it.
 */
export function PageMenu({ page, onPick }: { page: Page; onPick: (page: Page) => void }) {
  const term = useTerm()
  const t = useT()
  // Page names and notes are interface text; term() still turns the 干支 etc. in them to 繁體
  const tr = (text: string) => term(t(text))
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const current = ALL.find((p) => p.page === page)!

  // Opening puts the focus on the current page's item.
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
  }, [open])
  const onKey = (e: React.KeyboardEvent) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
    } else if (e.key === 'Escape') {
      button.current?.focus()
    } else if (e.key === 'Tab') {
      close()
    }
  }

  return (
    <div className="page-menu" ref={ref}>
      <button
        ref={button}
        type="button"
        className="page-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="page-menu"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span>{tr(current.name)}</span>
        <span className="chev" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div id="page-menu" className="page-menu-panel" role="menu" aria-label={t('页面')} onKeyDown={onKey}>
          {PAGE_GROUPS.map((g) => (
            <div key={g.title} className="page-menu-group" role="group" aria-label={tr(g.title)}>
              <div className="page-menu-title">{tr(g.title)}</div>
              {g.pages.map((p) => (
                <button
                  key={p.page}
                  type="button"
                  role="menuitemradio"
                  aria-checked={p.page === page}
                  className={`page-menu-item${p.page === page ? ' on' : ''}`}
                  onClick={() => {
                    close()
                    button.current?.focus()
                    onPick(p.page)
                  }}
                >
                  <b>{tr(p.name)}</b>
                  <small>{tr(p.desc)}</small>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
