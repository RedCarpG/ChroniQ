import { useCallback, useRef, useState } from 'react'
import { useT, useTerm } from '../settingsContext'
import { useDismiss } from './useDismiss'

export type Page = 'today' | 'calendar' | 'bazi' | 'ziwei' | 'star' | 'sky' | 'moon' | 'solar'

/** The pages, grouped as the menu lists them (shown through t(): src/i18n/__tests__/calendar.test.ts checks the English) */
export const PAGE_GROUPS: { title: string; pages: { page: Page; name: string; /** In the navigation, where the full name is long */ short?: string; desc: string }[] }[] = [
  {
    title: '历法',
    pages: [
      { page: 'today', name: '今日', desc: '今天的黄历、今晚的天空、今日与命盘' },
      { page: 'calendar', name: '日历', desc: '公历、农历、节气、干支' },
      { page: 'sky', name: '天象', desc: '此刻天空、星座与星官' },
      { page: 'moon', name: '观月', desc: '月相、月出月落、天平动' },
      { page: 'solar', name: '太阳系', desc: '行星的轨道、距离与顺逆行' },
    ],
  },
  {
    title: '命理',
    pages: [
      { page: 'bazi', name: '八字排盘', short: '八字', desc: '四柱、十神、神煞、大运流年' },
      { page: 'ziwei', name: '紫微斗数', short: '紫微', desc: '十二宫、四化飞星、运限' },
      { page: 'star', name: '星盘', desc: '本命、行运推运、合盘、组合盘' },
    ],
  },
]
/**
 * The pages, in their groups, always in sight: the current page's group lies open and the others are
 * one button each. Pressing one opens it instead, to look or to go there; clicking anywhere else or
 * Escape returns to the current page's group. A new group needs only an entry in PAGE_GROUPS.
 */
export function PageNav({ page, onPick, className }: { page: Page; onPick: (page: Page) => void; className?: string }) {
  const term = useTerm()
  const t = useT()
  // Page names and notes are interface text; term() still turns the 干支 etc. in them to 繁體
  const tr = (text: string) => term(t(text))
  /** The group opened by hand, for now */
  const [peek, setPeek] = useState<string | null>(null)
  const ref = useRef<HTMLElement>(null)
  const close = useCallback(() => setPeek(null), [])
  useDismiss(ref, peek !== null, close)
  const home = PAGE_GROUPS.find((g) => g.pages.some((p) => p.page === page))?.title
  const open = peek ?? home
  return (
    <nav
      ref={ref}
      className={`page-nav${className ? ` ${className}` : ''}`}
      aria-label={t('页面')}
      data-sounds="page"
      // Tabbing out of it counts as going elsewhere
      onBlur={(e) => {
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) close()
      }}
    >
      {PAGE_GROUPS.map((g) => {
        const isOpen = g.title === open
        return (
          <div key={g.title} className={`page-nav-group${isOpen ? ' open' : ''}${g.title === home ? ' home' : ''}`} role="group" aria-label={tr(g.title)}>
            <button
              type="button"
              className="page-nav-group-btn"
              aria-expanded={isOpen}
              title={g.pages.map((p) => tr(p.short ?? p.name)).join(' · ')}
              // Pressed again, or the current page's own: back to the current page's group
              onClick={() => setPeek(g.title === home || g.title === peek ? null : g.title)}
            >
              {tr(g.title)}
            </button>
            {/* Always there, so opening and folding can slide (styles.css .page-nav-pages) */}
            <div className="page-nav-pages" inert={!isOpen}>
              <div>
                {g.pages.map((p) => (
                  <button
                    key={p.page}
                    type="button"
                    className={`page-nav-item${p.page === page ? ' on' : ''}`}
                    aria-current={p.page === page ? 'page' : undefined}
                    title={tr(p.desc)}
                    onClick={() => {
                      close()
                      onPick(p.page)
                    }}
                  >
                    {tr(p.short ?? p.name)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </nav>
  )
}
